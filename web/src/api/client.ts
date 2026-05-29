import type { CanvasSnapshot } from "../canvas/flowTypes";

export type ApiProvider = {
  id: string;
  name: string;
  baseUrl: string;
  protocol: "openai" | "apimart";
  enabled: boolean;
  primary: boolean;
  imageModels: string[];
  chatModels: string[];
  videoModels: string[];
  hasKey: boolean;
  keyPreview: string;
  capabilities: ProviderCapabilities;
};

export type EditableApiProvider = ApiProvider & {
  apiKey?: string;
};

export type ProviderCapabilityStatus = "available" | "inferred" | "unavailable";

export type ProviderCapability = {
  label: string;
  status: ProviderCapabilityStatus;
  source: "model" | "protocol" | "none";
  modelCount: number;
  reason: string;
};

export type ProviderCapabilities = Record<"text2img" | "img2img" | "inpaint" | "video" | "llm", ProviderCapability>;
export type ProviderReadiness =
  | { ready: false; reason: "no_provider"; message: string }
  | { ready: false; reason: "missing_key"; message: string; primaryProviderId: string }
  | { ready: true; reason: "ready"; message: string; primaryProviderId: string };

export type ProviderListResponse = {
  providers: ApiProvider[];
  readiness: ProviderReadiness;
};

export type FlowExecutionNode = {
  nodeId: string;
  nodeType: string;
  status: string;
  attempts: number;
  latencyMs: number;
  inputAssetIds?: string[];
  outputAssetIds: string[];
  outputAssets?: Array<{ assetId: string; url: string }>;
  data?: Record<string, unknown>;
  errorMessage?: string;
};

export type CanvasRunNode = {
  nodeId: string;
  nodeType: string;
  status: string;
  attempts: number;
  latencyMs: number;
  providerId?: string;
  model?: string;
  prompt?: string;
  versionId?: string;
  inputAssetIds: string[];
  outputAssetIds: string[];
  errorMessage?: string;
};

export type CanvasRunRecord = {
  runId: string;
  flowId: string;
  canvasId: string;
  targetNodeId?: string;
  status: "success" | "failed";
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  snapshot: CanvasSnapshot;
  nodes: CanvasRunNode[];
  outputAssetIds: string[];
  errorMessage?: string;
};

export type CanvasSession = {
  sessionId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  currentVersionId?: string;
  versions: Array<{
    versionId: string;
    sourceRunId?: string;
    sourceNodeId?: string;
    providerId?: string;
    action: string;
    model: string;
    prompt: string;
    parentAssetIds?: string[];
    outputAssetIds: string[];
    status: string;
  }>;
  runs?: CanvasRunRecord[];
};

export type AssetProvenance = {
  assetId: string;
  chain: Array<{
    assetId: string;
    versionId?: string;
    parentAssetIds: string[];
    sourceRunId?: string;
    sourceNodeId?: string;
    providerId?: string;
    action?: string;
    model?: string;
    prompt?: string;
    status?: string;
    createdAt?: string;
  }>;
};

export type RagEvent = {
  event_id: string;
  timestamp: string;
  session_id: string;
  action: string;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
  input_assets: string[];
  output_assets: string[];
  status: "success" | "failed";
  latency_ms: number;
  error_message?: string;
  flow_id?: string;
  canvas_id?: string;
  canvas_snapshot_path?: string;
  target_node_id?: string;
  run_id?: string;
  node_id?: string;
  node_type?: string;
  node_status?: string;
  retry_attempt?: number;
  max_retries?: number;
  node_latency_ms?: number;
  node_inputs?: Record<string, unknown>;
};

export type FlowExecutionResponse = {
  sessionId: string;
  flowId: string;
  runId: string;
  canvas: {
    canvasId: string;
    updatedAt: string;
  };
  nodes: FlowExecutionNode[];
  outputAssets: Array<{ assetId: string; url: string }>;
  run: CanvasRunRecord;
};

export type StoredCanvas = CanvasSnapshot & {
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadedAsset = {
  assetId: string;
  kind: string;
  path: string;
  publicUrl: string;
  mime: string;
  size: number;
  createdAt: string;
};

export async function executeCanvasFlow(flow: CanvasSnapshot, targetNodeId?: string): Promise<FlowExecutionResponse> {
  const response = await fetch("/api/flows/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: flow.sessionId,
      targetNodeId,
      flow
    })
  });
  const json = await response.json();

  if (!json.ok) {
    throw new Error(json.error || json.data?.run?.errorMessage || "流程执行失败");
  }

  return json.data as FlowExecutionResponse;
}

export async function uploadImage(
  file: File,
  sessionId?: string,
  roleTag = "素材"
): Promise<{ sessionId: string; asset: UploadedAsset }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "base");
  form.append("roleTag", roleTag);
  if (sessionId) {
    form.append("sessionId", sessionId);
  }

  const response = await fetch("/api/upload", {
    method: "POST",
    body: form
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "图片上传失败");
  }
  return json.data as { sessionId: string; asset: UploadedAsset };
}

export async function saveCanvasSnapshot(flow: CanvasSnapshot, title = "画布"): Promise<StoredCanvas> {
  const response = await fetch(`/api/canvases/${encodeURIComponent(flow.canvasId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...flow,
      title
    })
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "保存画布失败");
  }
  return json.data as StoredCanvas;
}

export async function loadCanvasSnapshot(canvasId: string): Promise<StoredCanvas> {
  const response = await fetch(`/api/canvases/${encodeURIComponent(canvasId)}`);
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "读取画布失败");
  }
  return json.data as StoredCanvas;
}

export async function listCanvasSnapshots(): Promise<StoredCanvas[]> {
  const response = await fetch("/api/canvases");
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "读取画布列表失败");
  }
  return json.data as StoredCanvas[];
}

export async function fetchSession(sessionId: string): Promise<CanvasSession> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "读取 session 失败");
  }
  return json.data as CanvasSession;
}

export async function fetchAssetProvenance(sessionId: string, assetId: string): Promise<AssetProvenance> {
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/assets/${encodeURIComponent(assetId)}/provenance`
  );
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "读取来源链失败");
  }
  return json.data as AssetProvenance;
}

export async function fetchRagEvents(query: {
  sessionId?: string;
  runId?: string;
  assetId?: string;
  keyword?: string;
  limit?: number;
}): Promise<RagEvent[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const response = await fetch(`/api/logs?${params.toString()}`);
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "读取 RAG 日志失败");
  }
  return json.data as RagEvent[];
}

function providerReadinessFromJson(json: { meta?: { readiness?: ProviderReadiness } }, providers: ApiProvider[]): ProviderReadiness {
  if (json.meta?.readiness) {
    return json.meta.readiness;
  }
  const primary = providers.find((provider) => provider.primary && provider.enabled) ?? providers.find((provider) => provider.enabled);
  if (!primary) {
    return { ready: false, reason: "no_provider", message: "未配置 API 平台" };
  }
  if (!primary.hasKey) {
    return { ready: false, reason: "missing_key", message: `${primary.name} 缺少 API Key`, primaryProviderId: primary.id };
  }
  return { ready: true, reason: "ready", message: `${primary.name} 已可用于生成`, primaryProviderId: primary.id };
}

export async function fetchProviderList(): Promise<ProviderListResponse> {
  const response = await fetch("/api/providers");
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "读取 API 平台失败");
  }
  const providers = json.data as ApiProvider[];
  return { providers, readiness: providerReadinessFromJson(json, providers) };
}

export async function fetchProviders(): Promise<ApiProvider[]> {
  return (await fetchProviderList()).providers;
}

export async function saveProviderList(providers: EditableApiProvider[]): Promise<ProviderListResponse> {
  const response = await fetch("/api/providers", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providers })
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "保存 API 平台失败");
  }
  const saved = json.data as ApiProvider[];
  return { providers: saved, readiness: providerReadinessFromJson(json, saved) };
}

export async function saveProviders(providers: EditableApiProvider[]): Promise<ApiProvider[]> {
  return (await saveProviderList(providers)).providers;
}

export type ProviderModels = {
  total: number;
  all: string[];
  imageModels: string[];
  chatModels: string[];
  videoModels: string[];
  capabilities: ProviderCapabilities;
};

export async function testProviderConnection(input: {
  providerId?: string;
  baseUrl: string;
  apiKey?: string;
  protocol?: ApiProvider["protocol"];
}): Promise<ProviderModels & { ok: boolean; message: string }> {
  const response = await fetch("/api/providers/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "验证 API 失败");
  }
  return json.data as ProviderModels & { ok: boolean; message: string };
}

export async function fetchProviderModels(input: {
  providerId?: string;
  baseUrl: string;
  apiKey?: string;
  protocol?: ApiProvider["protocol"];
}): Promise<ProviderModels> {
  const response = await fetch("/api/providers/fetch-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "拉取模型失败");
  }
  return json.data as ProviderModels;
}
