import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import express from "express";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeFlowSnapshot } from "./flows/execute";
import type { FlowSnapshot } from "./flows/types";
import { filterEvents, queryEvents, type RagEvent } from "./logger";
import { apiRouter } from "./routes/api";
import { loadCanvas, saveCanvas } from "./services/canvases";
import {
  appendRunRecord,
  appendVersion,
  saveSession,
  traceAssetProvenance,
  type CanvasSession
} from "./services/sessions";

const runnerState = vi.hoisted(() => ({ failImg2Img: false }));

vi.mock("./flows/runners/api", () => ({
  createApiFlowRunners: () => ({
    api_img2img: async () => {
      if (runnerState.failImg2Img) {
        throw new Error("mock img2img route failure");
      }

      return {
        outputAssetIds: ["asset_out_route"],
        outputAssets: [{ assetId: "asset_out_route", url: "/outputs/asset_out_route.png" }],
        data: {
          versionId: "v_route",
          providerId: "fake-provider",
          model: "fake-image-model",
          prompt: "cinematic product shot",
          inputAssetIds: ["asset_base"]
        }
      };
    }
  })
}));

const canvasId = "c_phase_one_closure";
const sessionId = "s_phase_one_closure";
const canvasPath = path.join(process.cwd(), "logs", "canvases", `${canvasId}.json`);
const sessionPath = path.join(process.cwd(), "logs", "sessions", `${sessionId}.json`);
const ragLogPath = path.join(process.cwd(), "logs", "RAG_LOG.md");
const ragJsonlPath = path.join(process.cwd(), "logs", "rag_events.jsonl");
const outputDir = path.join(process.cwd(), "outputs", "20260520");
const relativeCanvasSnapshotPath = `logs/canvases/${canvasId}.json`;
let originalRagLog: string | undefined;
let originalRagJsonl: string | undefined;

function phaseOneFlow(): FlowSnapshot {
  return {
    canvasId,
    sessionId,
    nodes: [
      { id: "img1", type: "image", x: 0, y: 0, width: 220, height: 150, data: { assetId: "asset_base" } },
      { id: "prompt1", type: "prompt", x: 0, y: 210, width: 220, height: 120, data: { text: "cinematic product shot" } },
      {
        id: "img2img1",
        type: "api_img2img",
        x: 300,
        y: 80,
        width: 260,
        height: 150,
        data: {
          providerId: "fake-provider",
          model: "fake-image-model",
          params: { strength: 0.5 },
          apiKey: "secret-should-not-leak",
          experimentalUnsafe: "unknown-should-not-leak"
        }
      },
      { id: "out1", type: "output", x: 640, y: 80, width: 260, height: 180, data: {} }
    ],
    edges: [
      { id: "e_img", from: "img1", to: "img2img1" },
      { id: "e_prompt", from: "prompt1", to: "img2img1" },
      { id: "e_out", from: "img2img1", to: "out1" }
    ],
    viewport: { x: -80, y: 24, zoom: 0.85 },
    selectedNodeId: "img2img1"
  };
}

function session(): CanvasSession {
  return {
    sessionId,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    versions: [],
    assets: []
  };
}

describe("phase one closure", () => {
  beforeEach(async () => {
    originalRagLog = await readOptionalFile(ragLogPath);
    originalRagJsonl = await readOptionalFile(ragJsonlPath);
  });

  afterEach(async () => {
    runnerState.failImg2Img = false;
    await rm(canvasPath, { force: true });
    await rm(sessionPath, { force: true });
    await rm(outputDir, { force: true, recursive: true });
    await restoreOptionalFile(ragLogPath, originalRagLog);
    await restoreOptionalFile(ragJsonlPath, originalRagJsonl);
  });

  it("keeps one canvas run replayable across execution, versions, RAG filters, and canvas restore", async () => {
    const flow = phaseOneFlow();
    const s = session();
    const runId = "run_phase_one";

    const result = await executeFlowSnapshot(flow, {
      sessionId,
      runners: {
        api_img2img: async ({ node, upstreamNodes }) => {
          const prompt = upstreamNodes.find((item) => item.type === "prompt")?.data.text;
          const baseAssetId = upstreamNodes.find((item) => item.type === "image")?.data.assetId;

          return {
            outputAssetIds: ["asset_out"],
            outputAssets: [{ assetId: "asset_out", url: "/outputs/asset_out.png" }],
            data: {
              versionId: "v_0001",
              providerId: node.data.providerId,
              model: node.data.model,
              prompt,
              inputAssetIds: [baseAssetId],
              parentAssetIds: [baseAssetId]
            }
          };
        }
      }
    });

    expect(result.ok).toBe(true);

    appendVersion(s, {
      action: "img2img",
      model: "fake-image-model",
      prompt: "cinematic product shot",
      params: { providerId: "fake-provider" },
      providerId: "fake-provider",
      sourceRunId: runId,
      sourceNodeId: "img2img1",
      parentAssetIds: ["asset_base"],
      baseAssetId: "asset_base",
      outputAssetIds: ["asset_out"],
      selectedOutputAssetId: "asset_out",
      latencyMs: 42,
      status: "success"
    });

    const run = appendRunRecord(s, {
      runId,
      flowId: runId,
      canvasId,
      status: "success",
      startedAt: "2026-05-20T00:00:00.000Z",
      completedAt: "2026-05-20T00:00:01.000Z",
      latencyMs: 1000,
      snapshot: flow,
      nodes: result.nodes
    });

    await saveCanvas({ ...flow, title: "Phase One Acceptance Canvas" });
    const restoredCanvas = await loadCanvas(canvasId);
    const trace = traceAssetProvenance(s, "asset_out");
    const ragEvent: RagEvent = {
      event_id: "event_phase_one",
      timestamp: "2026-05-20T00:00:01.000Z",
      session_id: sessionId,
      action: "flow_execute",
      model: "fake",
      prompt: "execute_canvas_flow",
      params: { runId, nodeRuns: run.nodes },
      input_assets: [],
      output_assets: ["asset_out"],
      status: "success",
      latency_ms: 1000,
      flow_id: runId,
      flow_structure: {
        nodes: flow.nodes.map((node) => `${node.id}:${node.type}`),
        edges: flow.edges.map((edge) => ({ from: edge.from, to: edge.to }))
      }
    };

    expect(run.outputAssetIds).toEqual(["asset_out"]);
    expect(run.nodes.find((node) => node.nodeId === "img2img1")).toMatchObject({
      providerId: "fake-provider",
      model: "fake-image-model",
      prompt: "cinematic product shot",
      inputAssetIds: ["asset_base"],
      outputAssetIds: ["asset_out"],
      versionId: "v_0001"
    });
    expect(restoredCanvas).toMatchObject({
      canvasId,
      sessionId,
      title: "Phase One Acceptance Canvas",
      selectedNodeId: "img2img1",
      viewport: { x: -80, y: 24, zoom: 0.85 }
    });
    expect(trace.chain.map((item) => [item.assetId, item.sourceRunId, item.sourceNodeId])).toEqual([
      ["asset_out", runId, "img2img1"],
      ["asset_base", undefined, undefined]
    ]);
    expect(filterEvents([ragEvent], { runId, assetId: "asset_out" })).toHaveLength(1);
  });

  it("executes via the API with a saved canvas snapshot and aggregate plus node RAG events", async () => {
    await saveSession(session());
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const server = app.listen(0);

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("test server did not bind to a TCP port");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/api/flows/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          flow: phaseOneFlow(),
          targetNodeId: "img2img1",
          title: "Route Auto Saved Canvas"
        })
      });
      const json = (await response.json()) as {
        ok: boolean;
        data: {
          canvas: { canvasId: string; updatedAt: string };
          runId: string;
          run: { snapshot: FlowSnapshot };
        };
      };

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.canvas.canvasId).toBe(canvasId);
      expect(json.data.run.snapshot.canvasId).toBe(canvasId);

      const restored = await loadCanvas(canvasId);
      expect(restored.title).toBe("Route Auto Saved Canvas");
      expect(restored.nodes.map((node) => node.id)).toContain("img2img1");

      const rawCanvas = await readFile(canvasPath, "utf8");
      expect(rawCanvas).toContain("Route Auto Saved Canvas");

      const events = await queryEvents({ runId: json.data.runId, limit: 20 });
      const aggregate = events.find((event) => event.node_id === undefined);
      const nodeEvent = events.find((event) => event.node_id === "img2img1");

      expect(aggregate).toMatchObject({
        canvas_id: canvasId,
        target_node_id: "img2img1",
        run_id: json.data.runId,
        status: "success"
      });
      expect(aggregate?.canvas_snapshot_path).toBe(relativeCanvasSnapshotPath);
      expect(nodeEvent).toMatchObject({
        canvas_id: canvasId,
        canvas_snapshot_path: relativeCanvasSnapshotPath,
        target_node_id: "img2img1",
        run_id: json.data.runId,
        node_id: "img2img1",
        node_type: "api_img2img",
        node_status: "success",
        input_assets: ["asset_base"],
        output_assets: ["/outputs/asset_out_route.png"],
        status: "success"
      });
      expect(nodeEvent?.node_inputs).toMatchObject({
        nodeId: "img2img1",
        nodeType: "api_img2img",
        model: "fake-image-model",
        providerId: "fake-provider",
        params: { strength: 0.5 },
        upstreamNodes: [
          { nodeId: "img1", nodeType: "image", imageAssetId: "asset_base" },
          { nodeId: "prompt1", nodeType: "prompt", prompt: "cinematic product shot" }
        ]
      });
      expect(JSON.stringify(nodeEvent?.node_inputs)).not.toContain("secret-should-not-leak");
      expect(JSON.stringify(nodeEvent?.node_inputs)).not.toContain("unknown-should-not-leak");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("logs aggregate and node-level RAG fields when API execution fails", async () => {
    runnerState.failImg2Img = true;
    await saveSession(session());
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const server = app.listen(0);

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("test server did not bind to a TCP port");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/api/flows/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          flow: phaseOneFlow(),
          targetNodeId: "img2img1",
          title: "Failed Route Canvas"
        })
      });
      const json = (await response.json()) as {
        ok: boolean;
        error: string;
        data: {
          runId: string;
        };
      };

      expect(response.status).toBe(500);
      expect(json.ok).toBe(false);
      expect(json.error).toBe("mock img2img route failure");

      const events = await queryEvents({ runId: json.data.runId, limit: 20 });
      const aggregate = events.find((event) => event.node_id === undefined);
      const failedNode = events.find((event) => event.node_id === "img2img1");

      expect(aggregate).toMatchObject({
        canvas_id: canvasId,
        canvas_snapshot_path: relativeCanvasSnapshotPath,
        target_node_id: "img2img1",
        run_id: json.data.runId,
        status: "failed",
        error_message: "mock img2img route failure"
      });
      expect(aggregate?.latency_ms).toEqual(expect.any(Number));
      expect(failedNode).toMatchObject({
        canvas_id: canvasId,
        canvas_snapshot_path: relativeCanvasSnapshotPath,
        target_node_id: "img2img1",
        run_id: json.data.runId,
        node_id: "img2img1",
        node_type: "api_img2img",
        node_status: "failed",
        status: "failed",
        error_message: "mock img2img route failure",
        retry_attempt: 3,
        max_retries: 3,
        output_assets: []
      });
      expect(failedNode?.latency_ms).toEqual(expect.any(Number));
      expect(failedNode?.node_latency_ms).toEqual(expect.any(Number));
      expect(failedNode?.node_inputs).toMatchObject({
        nodeId: "img2img1",
        nodeType: "api_img2img",
        model: "fake-image-model",
        providerId: "fake-provider",
        params: { strength: 0.5 },
        upstreamNodes: [
          { nodeId: "img1", nodeType: "image", imageAssetId: "asset_base" },
          { nodeId: "prompt1", nodeType: "prompt", prompt: "cinematic product shot" }
        ]
      });
      expect(JSON.stringify(failedNode?.node_inputs)).not.toContain("secret-should-not-leak");
      expect(JSON.stringify(failedNode?.node_inputs)).not.toContain("unknown-should-not-leak");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  return readFile(filePath, "utf8").catch(() => undefined);
}

async function restoreOptionalFile(filePath: string, content: string | undefined): Promise<void> {
  if (content === undefined) {
    await rm(filePath, { force: true });
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
