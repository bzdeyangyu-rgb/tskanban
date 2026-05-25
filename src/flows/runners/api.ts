import { saveOutputAsAsset } from "../../services/assets";
import { appendVersion, attachAsset, type CanvasSession } from "../../services/sessions";
import { providerStore, type ApiProvider } from "../../services/providers";
import { generateImage as defaultGenerateImage, type ImageRequest, type ImageResult } from "../../imageApi";
import type { FlowRunner, RunnerOutput } from "../execute";
import type { ExecutableNodeType, FlowNode, NodeExecutionResult } from "../types";

export type ApiFlowRunnerOptions = {
  session: CanvasSession;
  flowId?: string | undefined;
  generateImage?: (request: ImageRequest) => Promise<ImageResult>;
  getProvider?: (providerId?: string | undefined) => Promise<ApiProvider>;
};

export function createApiFlowRunners(
  options: ApiFlowRunnerOptions
): Partial<Record<ExecutableNodeType, FlowRunner>> {
  return {
    api_text2img: (input) => runApiText2Img(input, options),
    api_img2img: (input) => runApiImg2Img(input, options),
    api_inpaint: (input) => runApiInpaint(input, options),
    video: (input) => runApiVideo(input, options)
  };
}

async function runApiText2Img(input: Parameters<FlowRunner>[0], options: ApiFlowRunnerOptions): Promise<RunnerOutput> {
  const started = Date.now();
  const model = stringData(input.node, "model");
  const prompt = promptFrom(input.upstreamNodes, input.node);
  const negativePrompt = optionalStringData(input.node, "negativePrompt");
  const params = imageParamsFrom(input.node);
  const provider = await providerFrom(input.node, options);
  const result = await generate(options, {
    action: "text2img",
    model,
    prompt,
    negativePrompt,
    params,
    provider
  });

  return persistGeneratedOutputs(options.session, {
    action: "text2img",
    model,
    prompt,
    negativePrompt,
    params,
    result,
    latencyMs: Date.now() - started,
    providerId: provider?.id,
    sourceRunId: options.flowId,
    sourceNodeId: input.node.id,
    parentAssetIds: []
  });
}

async function runApiImg2Img(input: Parameters<FlowRunner>[0], options: ApiFlowRunnerOptions): Promise<RunnerOutput> {
  const started = Date.now();
  const model = stringData(input.node, "model");
  const prompt = promptFrom(input.upstreamNodes, input.node);
  const negativePrompt = optionalStringData(input.node, "negativePrompt");
  const params = imageParamsFrom(input.node);
  const provider = await providerFrom(input.node, options);
  const base = findInputAsset(options.session, input.upstreamNodes, input.upstreamResults, input.node, "baseAssetId");

  const result = await generate(options, {
    action: "img2img",
    model,
    prompt,
    negativePrompt,
    params,
    inputImage: base.path,
    provider
  });

  return persistGeneratedOutputs(options.session, {
    action: "img2img",
    model,
    prompt,
    negativePrompt,
    params,
    result,
    latencyMs: Date.now() - started,
    providerId: provider?.id,
    sourceRunId: options.flowId,
    sourceNodeId: input.node.id,
    parentAssetIds: [base.assetId],
    baseAssetId: base.assetId
  });
}

async function runApiInpaint(input: Parameters<FlowRunner>[0], options: ApiFlowRunnerOptions): Promise<RunnerOutput> {
  const started = Date.now();
  const model = stringData(input.node, "model");
  const prompt = promptFrom(input.upstreamNodes, input.node);
  const negativePrompt = optionalStringData(input.node, "negativePrompt");
  const params = imageParamsFrom(input.node);
  const provider = await providerFrom(input.node, options);
  const base = findInputAsset(options.session, input.upstreamNodes, input.upstreamResults, input.node, "baseAssetId");
  const mask = findAssetById(options.session, stringData(input.node, "maskAssetId"));

  const result = await generate(options, {
    action: "inpaint",
    model,
    prompt,
    negativePrompt,
    params,
    inputImage: base.path,
    maskImage: mask.path,
    provider
  });

  return persistGeneratedOutputs(options.session, {
    action: "inpaint",
    model,
    prompt,
    negativePrompt,
    params,
    result,
    latencyMs: Date.now() - started,
    providerId: provider?.id,
    sourceRunId: options.flowId,
    sourceNodeId: input.node.id,
    parentAssetIds: [base.assetId, mask.assetId],
    baseAssetId: base.assetId,
    maskAssetId: mask.assetId
  });
}

async function runApiVideo(input: Parameters<FlowRunner>[0], options: ApiFlowRunnerOptions): Promise<RunnerOutput> {
  const started = Date.now();
  const model = stringData(input.node, "model");
  const prompt = promptFrom(input.upstreamNodes, input.node);
  const negativePrompt = optionalStringData(input.node, "negativePrompt");
  const params = imageParamsFrom(input.node);
  const provider = await providerFrom(input.node, options);
  const base = findOptionalInputAsset(options.session, input.upstreamNodes, input.upstreamResults, input.node, "baseAssetId");

  const result = await generate(options, {
    action: "video",
    model,
    prompt,
    negativePrompt,
    params,
    inputImage: base?.path,
    provider
  });

  return persistGeneratedOutputs(options.session, {
    action: "video",
    model,
    prompt,
    negativePrompt,
    params,
    result,
    latencyMs: Date.now() - started,
    providerId: provider?.id,
    sourceRunId: options.flowId,
    sourceNodeId: input.node.id,
    parentAssetIds: base ? [base.assetId] : [],
    baseAssetId: base?.assetId
  });
}

async function generate(options: ApiFlowRunnerOptions, request: ImageRequest): Promise<ImageResult> {
  const generateImage = options.generateImage ?? defaultGenerateImage;
  return generateImage(request);
}

async function persistGeneratedOutputs(
  session: CanvasSession,
  input: {
    action: "text2img" | "img2img" | "inpaint" | "video";
    model: string;
    prompt: string;
    negativePrompt?: string | undefined;
    params?: Record<string, unknown> | undefined;
    result: ImageResult;
    latencyMs: number;
    providerId?: string | undefined;
    sourceRunId?: string | undefined;
    sourceNodeId?: string | undefined;
    parentAssetIds?: string[] | undefined;
    baseAssetId?: string | undefined;
    maskAssetId?: string | undefined;
  }
): Promise<RunnerOutput> {
  if (input.result.outputAssets.length === 0) {
    throw new Error(`${input.action} returned no output assets`);
  }

  const outputAssets = await Promise.all(
    input.result.outputAssets.map((output) => saveOutputAsAsset({ output, kind: "generated" }))
  );

  for (const asset of outputAssets) {
    attachAsset(session, asset);
  }

  const version = appendVersion(session, {
    action: input.action,
    model: input.model,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    params: input.params ?? {},
    providerId: input.providerId,
    sourceRunId: input.sourceRunId,
    sourceNodeId: input.sourceNodeId,
    parentAssetIds: input.parentAssetIds,
    baseAssetId: input.baseAssetId,
    maskAssetId: input.maskAssetId,
    outputAssetIds: outputAssets.map((asset) => asset.assetId),
    selectedOutputAssetId: outputAssets[0]?.assetId,
    latencyMs: input.latencyMs,
    status: "success"
  });

  return {
    outputAssetIds: outputAssets.map((asset) => asset.assetId),
    outputAssets: outputAssets.map((asset) => ({ assetId: asset.assetId, url: asset.publicUrl })),
    data: {
      versionId: version.versionId,
      providerId: input.providerId,
      sourceRunId: input.sourceRunId,
      sourceNodeId: input.sourceNodeId,
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.params ?? {},
      parentAssetIds: input.parentAssetIds ?? [],
      inputAssetIds: input.parentAssetIds ?? [],
      raw: input.result.raw
    }
  };
}

function stringData(node: FlowNode, key: string): string {
  const value = node.data[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`${node.id} missing required data.${key}`);
}

function optionalStringData(node: FlowNode, key: string): string | undefined {
  const value = node.data[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordData(node: FlowNode, key: string): Record<string, unknown> | undefined {
  const value = node.data[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function imageParamsFrom(node: FlowNode): Record<string, unknown> | undefined {
  const params: Record<string, unknown> = { ...(recordData(node, "params") ?? {}) };
  addOptionalStringParam(params, "resolution", node.data.resolution);
  addOptionalStringParam(params, "ratio", node.data.ratio);
  addOptionalNumberParam(params, "count", node.data.count);
  addOptionalNumberParam(params, "width", node.data.customWidth);
  addOptionalNumberParam(params, "height", node.data.customHeight);
  return Object.keys(params).length ? params : undefined;
}

function addOptionalStringParam(params: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === "string" && value.trim()) {
    params[key] = value.trim();
  }
}

function addOptionalNumberParam(params: Record<string, unknown>, key: string, value: unknown): void {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (Number.isFinite(numeric)) {
    params[key] = numeric;
  }
}

function promptFrom(upstreamNodes: FlowNode[], node: FlowNode): string {
  const direct = optionalStringData(node, "prompt");
  if (direct) {
    return direct;
  }

  const promptNode = upstreamNodes.find((upstream) => upstream.type === "prompt");
  if (promptNode) {
    return stringData(promptNode, "text");
  }

  throw new Error(`${node.id} requires an upstream prompt node or data.prompt`);
}

function findInputAsset(
  session: CanvasSession,
  upstreamNodes: FlowNode[],
  upstreamResults: NodeExecutionResult[],
  node: FlowNode,
  dataKey: string
) {
  const explicit = optionalStringData(node, dataKey);
  if (explicit) {
    return findAssetById(session, explicit);
  }

  const upstreamImage = upstreamNodes.find((upstream) => upstream.type === "image");
  const upstreamImageAssetId = upstreamImage ? optionalStringData(upstreamImage, "assetId") : undefined;
  if (upstreamImageAssetId) {
    return findAssetById(session, upstreamImageAssetId);
  }

  const upstreamGeneratedAssetId = upstreamResults.flatMap((result) => result.outputAssetIds)[0];
  if (upstreamGeneratedAssetId) {
    return findAssetById(session, upstreamGeneratedAssetId);
  }

  throw new Error(`${node.id} requires an input image asset`);
}

function findOptionalInputAsset(
  session: CanvasSession,
  upstreamNodes: FlowNode[],
  upstreamResults: NodeExecutionResult[],
  node: FlowNode,
  dataKey: string
) {
  try {
    return findInputAsset(session, upstreamNodes, upstreamResults, node, dataKey);
  } catch {
    return undefined;
  }
}

function findAssetById(session: CanvasSession, assetId: string) {
  const asset = session.assets.find((item) => item.assetId === assetId);
  if (!asset) {
    throw new Error(`asset not found in session: ${assetId}`);
  }
  return asset;
}

async function providerFrom(node: FlowNode, options: ApiFlowRunnerOptions): Promise<ApiProvider | undefined> {
  const providerId = optionalStringData(node, "providerId");
  if (!providerId && !options.getProvider) {
    return undefined;
  }
  const getProvider = options.getProvider ?? providerStore.getProvider;
  return getProvider(providerId);
}
