import { Router } from "express";
import multer from "multer";
import {
  text2imgSchema,
  img2imgSchema,
  inpaintSchema,
  uploadBodySchema,
  createSessionSchema,
  logsQuerySchema,
  flowValidateSchema,
  flowExecuteSchema,
  canvasExecuteSchema,
  createCanvasSchema,
  saveCanvasSchema,
  saveProvidersSchema,
  providerConnectionSchema
} from "../types/contracts";
import { isSupportedImageMime, saveBufferAsAsset, saveOutputAsAsset } from "../services/assets";
import {
  appendRunRecord,
  appendVersion,
  attachAsset,
  createSession,
  getOrCreateSession,
  loadSession,
  saveSession
} from "../services/sessions";
import { generateImage } from "../imageApi";
import { createBaseEvent, createFlowId, logEvent, queryEvents } from "../logger";
import { listTemplates, saveTemplate, findTemplate } from "../templates";
import { validateFlowSnapshot } from "../flows/validate";
import { createCanvas, loadCanvas, saveCanvas } from "../services/canvases";
import { executeFlowSnapshot } from "../flows/execute";
import { createApiFlowRunners } from "../flows/runners/api";
import {
  fetchProviderModels,
  providerStore,
  publicProvider,
  testProviderConnection
} from "../services/providers";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

export const apiRouter = Router();

type FlowNodeType = "asset_base" | "asset_style" | "prompt" | "text2img" | "mask" | "inpaint" | "output";

type FlowNode = {
  id: string;
  type: FlowNodeType;
  label: string;
  data?: Record<string, unknown> | undefined;
};

type FlowEdge = {
  from: string;
  to: string;
};

type Flow = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

type NodeState = "idle" | "running" | "success" | "failed" | "retrying";

type ExecuteNodeResult = {
  nodeId: string;
  nodeType: FlowNodeType;
  state: NodeState;
  attempts: number;
  latencyMs: number;
  errorMessage?: string;
};

const MAX_RETRIES = 3;

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

apiRouter.post("/sessions", async (req, res) => {
  try {
    const input = createSessionSchema.parse(req.body ?? {});
    const session = await createSession({ title: input.title });
    res.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.get("/sessions/:sessionId", async (req, res) => {
  try {
    const session = await loadSession(req.params.sessionId);
    res.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json({ ok: false, error: message });
  }
});

apiRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const body = uploadBodySchema.parse(req.body ?? {});
    if (!req.file) {
      res.status(400).json({ ok: false, error: "File is required" });
      return;
    }

    if (!isSupportedImageMime(req.file.mimetype)) {
      res.status(400).json({ ok: false, error: `Unsupported mime type: ${req.file.mimetype}` });
      return;
    }

    const session = await getOrCreateSession(body.sessionId);
    const asset = await saveBufferAsAsset({
      buffer: req.file.buffer,
      kind: body.kind,
      mimeType: req.file.mimetype
    });
    attachAsset(session, asset);
    await saveSession(session);

    await logEvent({
      ...createBaseEvent({
        sessionId: session.sessionId,
        action: "asset_upload",
        model: "local",
        prompt: `upload:${body.kind}`,
        params: {
          mime: asset.mime,
          size: asset.size,
          roleTag: body.roleTag
        },
        inputAssets: []
      }),
      output_assets: [asset.publicUrl],
      status: "success",
      latency_ms: 0
    });

    res.json({ ok: true, data: { sessionId: session.sessionId, asset } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.post("/text2img", async (req, res) => {
  let sessionId = "";
  const started = Date.now();
  try {
    const input = text2imgSchema.parse(req.body ?? {});
    const session = await getOrCreateSession(input.sessionId);
    sessionId = session.sessionId;

    const result = await generateImage({
      action: "text2img",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.params
    });

    const outputAssets = await Promise.all(
      result.outputAssets.map((output) => saveOutputAsAsset({ output, kind: "generated" }))
    );

    for (const asset of outputAssets) {
      attachAsset(session, asset);
    }

    const version = appendVersion(session, {
      action: "text2img",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.params ?? {},
      outputAssetIds: outputAssets.map((a) => a.assetId),
      selectedOutputAssetId: outputAssets[0]?.assetId,
      latencyMs: Date.now() - started,
      status: "success"
    });

    await saveSession(session);

    await logEvent({
      ...createBaseEvent({
        sessionId: session.sessionId,
        action: "text2img",
        model: input.model,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        params: input.params,
        inputAssets: []
      }),
      output_assets: outputAssets.map((a) => a.publicUrl),
      status: "success",
      latency_ms: Date.now() - started
    });

    res.json({
      ok: true,
      data: {
        sessionId: session.sessionId,
        versionId: version.versionId,
        outputAssets: outputAssets.map((a) => ({ assetId: a.assetId, url: a.publicUrl })),
        raw: result.raw
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (sessionId) {
      await logEvent({
        ...createBaseEvent({
          sessionId,
          action: "text2img",
          model: (req.body?.model as string) ?? "unknown",
          prompt: (req.body?.prompt as string) ?? "",
          negativePrompt: req.body?.negativePrompt as string | undefined,
          params: (req.body?.params as Record<string, unknown>) ?? {}
        }),
        output_assets: [],
        status: "failed",
        latency_ms: Date.now() - started,
        error_message: message
      });
    }
    res.status(500).json({ ok: false, error: message });
  }
});

apiRouter.get("/providers", async (_req, res) => {
  try {
    const providers = await providerStore.loadProviders();
    res.json({ ok: true, data: providers.map(publicProvider) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: message });
  }
});

apiRouter.put("/providers", async (req, res) => {
  try {
    const input = saveProvidersSchema.parse(req.body ?? {});
    const providers = await providerStore.saveProviders(input.providers);
    res.json({ ok: true, data: providers.map(publicProvider) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.post("/providers/test-connection", async (req, res) => {
  try {
    const input = providerConnectionSchema.parse(req.body ?? {});
    const apiKey = await providerApiKey(input.providerId, input.apiKey);
    const result = await testProviderConnection({ baseUrl: input.baseUrl, apiKey });
    res.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.post("/providers/fetch-models", async (req, res) => {
  try {
    const input = providerConnectionSchema.parse(req.body ?? {});
    const apiKey = await providerApiKey(input.providerId, input.apiKey);
    const result = await fetchProviderModels({ baseUrl: input.baseUrl, apiKey });
    res.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.post("/img2img", async (req, res) => {
  let sessionId = "";
  const started = Date.now();
  try {
    const input = img2imgSchema.parse(req.body ?? {});
    const session = await getOrCreateSession(input.sessionId);
    sessionId = session.sessionId;

    const base = session.assets.find((asset) => asset.assetId === input.baseAssetId);
    if (!base) {
      res.status(400).json({ ok: false, error: "baseAssetId not found in session" });
      return;
    }

    const result = await generateImage({
      action: "img2img",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.params,
      inputImage: base.path
    });

    const outputAssets = await Promise.all(
      result.outputAssets.map((output) => saveOutputAsAsset({ output, kind: "generated" }))
    );

    for (const asset of outputAssets) {
      attachAsset(session, asset);
    }

    const version = appendVersion(session, {
      parentVersionId: input.parentVersionId,
      action: "img2img",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.params ?? {},
      baseAssetId: input.baseAssetId,
      outputAssetIds: outputAssets.map((asset) => asset.assetId),
      selectedOutputAssetId: outputAssets[0]?.assetId,
      latencyMs: Date.now() - started,
      status: "success"
    });

    await saveSession(session);

    await logEvent({
      ...createBaseEvent({
        sessionId: session.sessionId,
        action: "img2img",
        model: input.model,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        params: input.params,
        inputAssets: [base.publicUrl]
      }),
      output_assets: outputAssets.map((asset) => asset.publicUrl),
      status: "success",
      latency_ms: Date.now() - started
    });

    res.json({
      ok: true,
      data: {
        sessionId: session.sessionId,
        versionId: version.versionId,
        outputAssets: outputAssets.map((asset) => ({ assetId: asset.assetId, url: asset.publicUrl })),
        raw: result.raw
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (sessionId) {
      await logEvent({
        ...createBaseEvent({
          sessionId,
          action: "img2img",
          model: (req.body?.model as string) ?? "unknown",
          prompt: (req.body?.prompt as string) ?? "",
          negativePrompt: req.body?.negativePrompt as string | undefined,
          params: (req.body?.params as Record<string, unknown>) ?? {}
        }),
        output_assets: [],
        status: "failed",
        latency_ms: Date.now() - started,
        error_message: message
      });
    }
    res.status(500).json({ ok: false, error: message });
  }
});

apiRouter.post("/inpaint", async (req, res) => {
  let sessionId = "";
  const started = Date.now();
  try {
    const input = inpaintSchema.parse(req.body ?? {});
    const session = await getOrCreateSession(input.sessionId);
    sessionId = session.sessionId;

    const base = session.assets.find((a) => a.assetId === input.baseAssetId);
    const mask = session.assets.find((a) => a.assetId === input.maskAssetId);

    if (!base || !mask) {
      res.status(400).json({ ok: false, error: "baseAssetId or maskAssetId not found in session" });
      return;
    }

    const result = await generateImage({
      action: "inpaint",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.params,
      inputImage: base.path,
      maskImage: mask.path
    });

    const outputAssets = await Promise.all(
      result.outputAssets.map((output) => saveOutputAsAsset({ output, kind: "generated" }))
    );

    for (const asset of outputAssets) {
      attachAsset(session, asset);
    }

    const version = appendVersion(session, {
      parentVersionId: input.parentVersionId,
      action: "inpaint",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.params ?? {},
      baseAssetId: input.baseAssetId,
      maskAssetId: input.maskAssetId,
      outputAssetIds: outputAssets.map((a) => a.assetId),
      selectedOutputAssetId: outputAssets[0]?.assetId,
      latencyMs: Date.now() - started,
      status: "success"
    });

    await saveSession(session);

    await logEvent({
      ...createBaseEvent({
        sessionId: session.sessionId,
        action: "inpaint",
        model: input.model,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        params: input.params,
        inputAssets: [base.publicUrl, mask.publicUrl]
      }),
      output_assets: outputAssets.map((a) => a.publicUrl),
      status: "success",
      latency_ms: Date.now() - started,
      selection_box: input.selection
        ? {
            x: input.selection.x,
            y: input.selection.y,
            width: input.selection.width,
            height: input.selection.height,
            canvasWidth: input.selection.canvasWidth,
            canvasHeight: input.selection.canvasHeight
          }
        : undefined,
      local_prompt: input.selection?.localPrompt
    });

    res.json({
      ok: true,
      data: {
        sessionId: session.sessionId,
        versionId: version.versionId,
        outputAssets: outputAssets.map((a) => ({ assetId: a.assetId, url: a.publicUrl })),
        raw: result.raw
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (sessionId) {
      await logEvent({
        ...createBaseEvent({
          sessionId,
          action: "inpaint",
          model: (req.body?.model as string) ?? "unknown",
          prompt: (req.body?.prompt as string) ?? "",
          negativePrompt: req.body?.negativePrompt as string | undefined,
          params: (req.body?.params as Record<string, unknown>) ?? {}
        }),
        output_assets: [],
        status: "failed",
        latency_ms: Date.now() - started,
        error_message: message,
        selection_box: req.body?.selection
          ? {
              x: Number(req.body.selection.x),
              y: Number(req.body.selection.y),
              width: Number(req.body.selection.width),
              height: Number(req.body.selection.height),
              canvasWidth: Number(req.body.selection.canvasWidth),
              canvasHeight: Number(req.body.selection.canvasHeight)
            }
          : undefined,
        local_prompt:
          typeof req.body?.selection?.localPrompt === "string" ? (req.body.selection.localPrompt as string) : undefined
      });
    }
    res.status(500).json({ ok: false, error: message });
  }
});

apiRouter.post("/flows/validate", async (req, res) => {
  try {
    const input = flowValidateSchema.parse(req.body ?? {});
    const validation = validateFlowSnapshot(input.flow);

    await logEvent({
      ...createBaseEvent({
        sessionId: "flow_validation",
        action: "flow_validate",
        model: "local",
        prompt: "validate_flow",
        params: {
          nodeCount: input.flow.nodes.length,
          edgeCount: input.flow.edges.length,
          valid: validation.valid,
          errors: validation.errors
        }
      }),
      flow_id: createFlowId(),
      flow_structure: {
        nodes: input.flow.nodes.map((n) => `${n.id}:${n.type}`),
        edges: input.flow.edges.map((edge) => ({ from: edge.from, to: edge.to }))
      },
      output_assets: [],
      status: validation.valid ? "success" : "failed",
      latency_ms: 0
    });

    res.json({ ok: validation.valid, data: validation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.post("/canvases", async (req, res) => {
  try {
    const input = createCanvasSchema.parse(req.body ?? {});
    const canvas = await createCanvas(input);
    res.json({ ok: true, data: canvas });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.put("/canvases/:canvasId", async (req, res) => {
  try {
    const input = saveCanvasSchema.parse({
      ...(req.body ?? {}),
      canvasId: req.params.canvasId
    });
    const canvas = await saveCanvas(input);
    res.json({ ok: true, data: canvas });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.get("/canvases/:canvasId", async (req, res) => {
  try {
    const canvas = await loadCanvas(req.params.canvasId);
    res.json({ ok: true, data: canvas });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json({ ok: false, error: message });
  }
});

apiRouter.post("/flows/execute", async (req, res) => {
  const flowId = createFlowId();
  const runId = flowId;
  const startedAt = new Date().toISOString();
  const started = Date.now();

  try {
    const input = canvasExecuteSchema.parse(req.body ?? {});
    const session = await getOrCreateSession(input.sessionId ?? input.flow.sessionId);
    const runners = createApiFlowRunners({ session, flowId: runId, getProvider: providerStore.getProvider });
    const result = await executeFlowSnapshot(input.flow, {
      sessionId: session.sessionId,
      targetNodeId: input.targetNodeId,
      runners
    });
    const completedAt = new Date().toISOString();
    const latencyMs = Date.now() - started;
    const runRecord = appendRunRecord(session, {
      runId,
      flowId,
      canvasId: input.flow.canvasId,
      targetNodeId: input.targetNodeId,
      status: result.ok ? "success" : "failed",
      startedAt,
      completedAt,
      latencyMs,
      snapshot: input.flow,
      nodes: result.nodes,
      errorMessage: result.error
    });
    await saveSession(session);

    await logEvent({
      ...createBaseEvent({
        sessionId: session.sessionId,
        action: "flow_execute",
        model: "fake",
        prompt: "execute_canvas_flow",
        params: {
          canvasId: input.flow.canvasId,
          targetNodeId: input.targetNodeId,
          ok: result.ok,
          runId: runRecord.runId,
          nodeRuns: runRecord.nodes
        },
        inputAssets: []
      }),
      flow_id: flowId,
      flow_structure: {
        nodes: input.flow.nodes.map((node) => `${node.id}:${node.type}`),
        edges: input.flow.edges.map((edge) => ({ from: edge.from, to: edge.to }))
      },
      output_assets: result.nodes.flatMap((node) => (node.outputAssets ?? []).map((asset) => asset.url)),
      status: result.ok ? "success" : "failed",
      latency_ms: latencyMs,
      error_message: result.error
    });

    res.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      error: result.error,
      data: {
        sessionId: session.sessionId,
        flowId,
        runId,
        nodes: result.nodes,
        outputAssets: result.nodes.flatMap((node) => node.outputAssets ?? []),
        run: runRecord
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.post("/flows/execute-legacy", async (req, res) => {
  let sessionId = "";
  const flowId = createFlowId();
  const started = Date.now();

  try {
    const input = flowExecuteSchema.parse(req.body ?? {});
    const validation = validateFlow(input.flow);
    if (!validation.valid) {
      res.status(400).json({ ok: false, error: "flow invalid", data: validation });
      return;
    }

    const session = await getOrCreateSession(input.sessionId);
    sessionId = session.sessionId;

    const nodeStatus: ExecuteNodeResult[] = [];
    const context: {
      baseAssetId: string | undefined;
      styleAssetId: string | undefined;
      maskAssetId: string | undefined;
      latestOutputAssetId: string | undefined;
      latestOutputUrl: string | undefined;
      latestVersionId: string | undefined;
      model: string;
      prompt: string;
      negativePrompt: string | undefined;
      params: Record<string, unknown>;
      selection:
        | {
            x: number;
            y: number;
            width: number;
            height: number;
            canvasWidth: number;
            canvasHeight: number;
            localPrompt: string | undefined;
          }
        | undefined;
    } = {
      baseAssetId: input.run.baseAssetId,
      styleAssetId: input.run.styleAssetId,
      maskAssetId: input.run.maskAssetId,
      latestOutputAssetId: undefined,
      latestOutputUrl: undefined,
      latestVersionId: undefined,
      model: input.run.model,
      prompt: input.run.prompt,
      negativePrompt: input.run.negativePrompt,
      params: input.run.params ?? {},
      selection: input.run.selection
        ? {
            x: input.run.selection.x,
            y: input.run.selection.y,
            width: input.run.selection.width,
            height: input.run.selection.height,
            canvasWidth: input.run.selection.canvasWidth,
            canvasHeight: input.run.selection.canvasHeight,
            localPrompt: input.run.selection.localPrompt
          }
        : undefined
    };

    const runInput = {
      model: input.run.model,
      prompt: input.run.prompt,
      negativePrompt: input.run.negativePrompt,
      params: input.run.params,
      parentVersionId: input.run.parentVersionId,
      baseAssetId: input.run.baseAssetId,
      styleAssetId: input.run.styleAssetId,
      maskAssetId: input.run.maskAssetId,
      selection: input.run.selection
        ? {
            x: input.run.selection.x,
            y: input.run.selection.y,
            width: input.run.selection.width,
            height: input.run.selection.height,
            canvasWidth: input.run.selection.canvasWidth,
            canvasHeight: input.run.selection.canvasHeight,
            localPrompt: input.run.selection.localPrompt
          }
        : undefined
    };

    const nodeMap = new Map(input.flow.nodes.map((n) => [n.id, n]));

    for (const nodeId of validation.order) {
      const node = nodeMap.get(nodeId);
      if (!node) {
        continue;
      }

      const one = await executeNodeWithRetry({
        session,
        flowId,
        node,
        run: runInput,
        context,
        parentVersionId: input.run.parentVersionId
      });

      nodeStatus.push(one.status);

      if (one.status.state === "failed") {
        await saveSession(session);
        await logEvent({
          ...createBaseEvent({
            sessionId: session.sessionId,
            action: "flow_execute",
            model: input.run.model,
            prompt: input.run.prompt,
            negativePrompt: input.run.negativePrompt,
            params: input.run.params,
            inputAssets: []
          }),
          flow_id: flowId,
          flow_structure: {
            nodes: input.flow.nodes.map((n) => `${n.id}:${n.type}`),
            edges: input.flow.edges
          },
          output_assets: context.latestOutputUrl ? [context.latestOutputUrl] : [],
          status: "failed",
          latency_ms: Date.now() - started,
          node_id: node.id,
          node_type: node.type,
          node_status: "failed",
          retry_attempt: one.status.attempts,
          max_retries: MAX_RETRIES,
          node_latency_ms: one.status.latencyMs,
          error_message: one.status.errorMessage,
          selection_box: input.run.selection
            ? {
                x: input.run.selection.x,
                y: input.run.selection.y,
                width: input.run.selection.width,
                height: input.run.selection.height,
                canvasWidth: input.run.selection.canvasWidth,
                canvasHeight: input.run.selection.canvasHeight
              }
            : undefined,
          local_prompt: input.run.selection?.localPrompt
        });

        res.status(500).json({
          ok: false,
          error: one.status.errorMessage ?? "flow node failed",
          data: {
            sessionId: session.sessionId,
            flowId,
            failedNodeId: node.id,
            nodes: nodeStatus,
            versionId: context.latestVersionId
          }
        });
        return;
      }
    }

    await saveSession(session);

    await logEvent({
      ...createBaseEvent({
        sessionId: session.sessionId,
        action: "flow_execute",
        model: input.run.model,
        prompt: input.run.prompt,
        negativePrompt: input.run.negativePrompt,
        params: input.run.params,
        inputAssets: []
      }),
      flow_id: flowId,
      flow_structure: {
        nodes: input.flow.nodes.map((n) => `${n.id}:${n.type}`),
        edges: input.flow.edges
      },
      output_assets: context.latestOutputUrl ? [context.latestOutputUrl] : [],
      status: "success",
      latency_ms: Date.now() - started,
      node_status: "success",
      selection_box: input.run.selection
        ? {
            x: input.run.selection.x,
            y: input.run.selection.y,
            width: input.run.selection.width,
            height: input.run.selection.height,
            canvasWidth: input.run.selection.canvasWidth,
            canvasHeight: input.run.selection.canvasHeight
          }
        : undefined,
      local_prompt: input.run.selection?.localPrompt
    });

    res.json({
      ok: true,
      data: {
        sessionId: session.sessionId,
        flowId,
        versionId: context.latestVersionId,
        output: context.latestOutputUrl
          ? {
              assetId: context.latestOutputAssetId,
              url: context.latestOutputUrl
            }
          : null,
        nodes: nodeStatus
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (sessionId) {
      await logEvent({
        ...createBaseEvent({
          sessionId,
          action: "flow_execute",
          model: (req.body?.run?.model as string) ?? "unknown",
          prompt: (req.body?.run?.prompt as string) ?? "",
          negativePrompt: req.body?.run?.negativePrompt as string | undefined,
          params: (req.body?.run?.params as Record<string, unknown>) ?? {}
        }),
        flow_id: flowId,
        flow_structure: req.body?.flow
          ? {
              nodes: Array.isArray(req.body.flow.nodes)
                ? req.body.flow.nodes.map((n: { id?: string; type?: string }) => `${n.id ?? "unknown"}:${n.type ?? "unknown"}`)
                : [],
              edges: Array.isArray(req.body.flow.edges)
                ? req.body.flow.edges.map((e: { from?: string; to?: string }) => ({
                    from: e.from ?? "",
                    to: e.to ?? ""
                  }))
                : []
            }
          : undefined,
        output_assets: [],
        status: "failed",
        latency_ms: Date.now() - started,
        error_message: message
      });
    }
    res.status(500).json({ ok: false, error: message });
  }
});

apiRouter.get("/logs", async (req, res) => {
  try {
    const query = logsQuerySchema.parse(req.query);
    const events = await queryEvents(query);
    res.json({ ok: true, data: events });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.get("/templates", async (_req, res) => {
  const templates = await listTemplates();
  res.json({ ok: true, data: templates });
});

apiRouter.post("/templates", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const prompt = String(req.body?.prompt ?? "").trim();
    const negativePromptRaw = req.body?.negativePrompt;

    if (!name || !prompt) {
      res.status(400).json({ ok: false, error: "name and prompt are required" });
      return;
    }

    const template = await saveTemplate({
      name,
      prompt,
      negativePrompt: typeof negativePromptRaw === "string" ? negativePromptRaw : undefined
    });

    await logEvent({
      ...createBaseEvent({
        sessionId: "template",
        action: "prompt_template_create",
        model: "local",
        prompt,
        negativePrompt: template.negativePrompt,
        params: { name }
      }),
      output_assets: [],
      status: "success",
      latency_ms: 0
    });

    res.json({ ok: true, data: template });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

apiRouter.get("/templates/:name", async (req, res) => {
  const template = await findTemplate(req.params.name);
  if (!template) {
    res.status(404).json({ ok: false, error: "template not found" });
    return;
  }

  res.json({ ok: true, data: template });
});

async function providerApiKey(providerId: string | undefined, apiKey: string | undefined): Promise<string> {
  if (apiKey?.trim()) {
    return apiKey.trim();
  }
  if (providerId) {
    const provider = await providerStore.getProvider(providerId);
    if (provider.apiKey?.trim()) {
      return provider.apiKey.trim();
    }
  }
  throw new Error("API key is required");
}

function validateFlow(flow: Flow): { valid: boolean; errors: string[]; order: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(flow.nodes.map((n) => n.id));

  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(`edge invalid: ${edge.from} -> ${edge.to}`);
    }
  }

  const indegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const node of flow.nodes) {
    indegree.set(node.id, 0);
    graph.set(node.id, []);
  }

  for (const edge of flow.edges) {
    graph.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of indegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      break;
    }

    order.push(id);
    for (const to of graph.get(id) ?? []) {
      const next = (indegree.get(to) ?? 0) - 1;
      indegree.set(to, next);
      if (next === 0) {
        queue.push(to);
      }
    }
  }

  if (order.length !== flow.nodes.length) {
    errors.push("flow contains cycle");
  }

  const hasGenerator = flow.nodes.some((n) => n.type === "text2img" || n.type === "inpaint");
  if (!hasGenerator) {
    errors.push("flow must contain text2img or inpaint node");
  }

  return {
    valid: errors.length === 0,
    errors,
    order
  };
}

async function executeNodeWithRetry(input: {
  session: Awaited<ReturnType<typeof getOrCreateSession>>;
  flowId: string;
  node: FlowNode;
  run: {
    model: string;
    prompt: string;
    negativePrompt: string | undefined;
    params: Record<string, unknown> | undefined;
    parentVersionId: string | undefined;
    baseAssetId: string | undefined;
    styleAssetId: string | undefined;
    maskAssetId: string | undefined;
    selection:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
          canvasWidth: number;
          canvasHeight: number;
          localPrompt: string | undefined;
        }
      | undefined;
  };
  context: {
    baseAssetId: string | undefined;
    styleAssetId: string | undefined;
    maskAssetId: string | undefined;
    latestOutputAssetId: string | undefined;
    latestOutputUrl: string | undefined;
    latestVersionId: string | undefined;
    model: string;
    prompt: string;
    negativePrompt: string | undefined;
    params: Record<string, unknown>;
    selection:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
          canvasWidth: number;
          canvasHeight: number;
          localPrompt: string | undefined;
        }
      | undefined;
  };
  parentVersionId: string | undefined;
}): Promise<{ status: ExecuteNodeResult }> {
  const { session, node, run, context, flowId } = input;

  if (node.type !== "text2img" && node.type !== "inpaint") {
    if (node.type === "asset_base" && typeof context.baseAssetId === "string") {
      const base = session.assets.find((a) => a.assetId === context.baseAssetId);
      if (base) {
        context.latestOutputAssetId = base.assetId;
        context.latestOutputUrl = base.publicUrl;
      }
    }

    if (node.type === "mask" && typeof context.maskAssetId === "string") {
      const mask = session.assets.find((a) => a.assetId === context.maskAssetId);
      if (!mask) {
        return {
          status: {
            nodeId: node.id,
            nodeType: node.type,
            state: "failed",
            attempts: 1,
            latencyMs: 0,
            errorMessage: `mask asset not found: ${context.maskAssetId}`
          }
        };
      }
    }

    return {
      status: {
        nodeId: node.id,
        nodeType: node.type,
        state: "success",
        attempts: 1,
        latencyMs: 0
      }
    };
  }

  let attempt = 0;
  let lastError = "";

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    const started = Date.now();

    if (attempt > 1) {
      await logEvent({
        ...createBaseEvent({
          sessionId: session.sessionId,
          action: "flow_execute",
          model: run.model,
          prompt: run.prompt,
          negativePrompt: run.negativePrompt,
          params: run.params,
          inputAssets: []
        }),
        flow_id: flowId,
        node_id: node.id,
        node_type: node.type,
        node_status: "retrying",
        retry_attempt: attempt,
        max_retries: MAX_RETRIES,
        output_assets: [],
        status: "failed",
        latency_ms: 0,
        error_message: lastError
      });
    }

    try {
      if (node.type === "text2img") {
        const result = await generateImage({
          action: "text2img",
          model: run.model,
          prompt: run.prompt,
          negativePrompt: run.negativePrompt,
          params: run.params
        });

        const outputAssets = await Promise.all(
          result.outputAssets.map((output) => saveOutputAsAsset({ output, kind: "generated" }))
        );

        for (const asset of outputAssets) {
          attachAsset(session, asset);
        }

        const version = appendVersion(session, {
          parentVersionId: input.parentVersionId,
          action: "text2img",
          model: run.model,
          prompt: run.prompt,
          negativePrompt: run.negativePrompt,
          params: run.params ?? {},
          outputAssetIds: outputAssets.map((a) => a.assetId),
          selectedOutputAssetId: outputAssets[0]?.assetId,
          latencyMs: Date.now() - started,
          status: "success"
        });

        const firstOutput = outputAssets[0];
        context.latestOutputAssetId = firstOutput ? firstOutput.assetId : undefined;
        context.latestOutputUrl = firstOutput ? firstOutput.publicUrl : undefined;
        context.latestVersionId = version.versionId;
      }

      if (node.type === "inpaint") {
        const baseAssetId = context.baseAssetId ?? context.latestOutputAssetId;
        const maskAssetId = context.maskAssetId;

        const base = session.assets.find((a) => a.assetId === baseAssetId);
        const mask = session.assets.find((a) => a.assetId === maskAssetId);

        if (!base || !mask) {
          throw new Error("inpaint requires baseAssetId and maskAssetId in current session");
        }

        const promptForLocal = run.selection?.localPrompt?.trim() ? run.selection.localPrompt : run.prompt;
        const result = await generateImage({
          action: "inpaint",
          model: run.model,
          prompt: promptForLocal,
          negativePrompt: run.negativePrompt,
          params: run.params,
          inputImage: base.path,
          maskImage: mask.path
        });

        const outputAssets = await Promise.all(
          result.outputAssets.map((output) => saveOutputAsAsset({ output, kind: "generated" }))
        );

        for (const asset of outputAssets) {
          attachAsset(session, asset);
        }

        const version = appendVersion(session, {
          parentVersionId: input.parentVersionId,
          action: "inpaint",
          model: run.model,
          prompt: promptForLocal,
          negativePrompt: run.negativePrompt,
          params: run.params ?? {},
          baseAssetId,
          maskAssetId,
          outputAssetIds: outputAssets.map((a) => a.assetId),
          selectedOutputAssetId: outputAssets[0]?.assetId,
          latencyMs: Date.now() - started,
          status: "success"
        });

        const firstOutput = outputAssets[0];
        context.latestOutputAssetId = firstOutput ? firstOutput.assetId : undefined;
        context.latestOutputUrl = firstOutput ? firstOutput.publicUrl : undefined;
        context.latestVersionId = version.versionId;
      }

      const status: ExecuteNodeResult = {
        nodeId: node.id,
        nodeType: node.type,
        state: "success",
        attempts: attempt,
        latencyMs: Date.now() - started
      };

      await logEvent({
        ...createBaseEvent({
          sessionId: session.sessionId,
          action: "flow_execute",
          model: run.model,
          prompt: run.prompt,
          negativePrompt: run.negativePrompt,
          params: run.params,
          inputAssets: []
        }),
        flow_id: flowId,
        output_assets: context.latestOutputUrl ? [context.latestOutputUrl] : [],
        status: "success",
        latency_ms: status.latencyMs,
        node_id: node.id,
        node_type: node.type,
        node_status: "success",
        retry_attempt: attempt,
        max_retries: MAX_RETRIES,
        node_latency_ms: status.latencyMs,
        selection_box: run.selection
          ? {
              x: run.selection.x,
              y: run.selection.y,
              width: run.selection.width,
              height: run.selection.height,
              canvasWidth: run.selection.canvasWidth,
              canvasHeight: run.selection.canvasHeight
            }
          : undefined,
        local_prompt: run.selection?.localPrompt
      });

      return { status };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt >= MAX_RETRIES) {
        return {
          status: {
            nodeId: node.id,
            nodeType: node.type,
            state: "failed",
            attempts: attempt,
            latencyMs: Date.now() - started,
            errorMessage: lastError
          }
        };
      }
    }
  }

  return {
    status: {
      nodeId: node.id,
      nodeType: node.type,
      state: "failed",
      attempts: MAX_RETRIES,
      latencyMs: 0,
      errorMessage: lastError || "unknown"
    }
  };
}

