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
};

export type EditableApiProvider = ApiProvider & {
  apiKey?: string;
};

export type FlowExecutionNode = {
  nodeId: string;
  nodeType: string;
  status: string;
  attempts: number;
  latencyMs: number;
  outputAssetIds: string[];
  outputAssets?: Array<{ assetId: string; url: string }>;
  errorMessage?: string;
};

export type FlowExecutionResponse = {
  sessionId: string;
  flowId: string;
  nodes: FlowExecutionNode[];
  outputAssets: Array<{ assetId: string; url: string }>;
};

export async function executeCanvasFlow(flow: CanvasSnapshot): Promise<FlowExecutionResponse> {
  const response = await fetch("/api/flows/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: flow.sessionId,
      flow
    })
  });
  const json = await response.json();

  if (!json.ok) {
    throw new Error(json.error || "流程执行失败");
  }

  return json.data as FlowExecutionResponse;
}

export async function fetchProviders(): Promise<ApiProvider[]> {
  const response = await fetch("/api/providers");
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "读取 API 平台失败");
  }
  return json.data as ApiProvider[];
}

export async function saveProviders(providers: EditableApiProvider[]): Promise<ApiProvider[]> {
  const response = await fetch("/api/providers", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providers })
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "保存 API 平台失败");
  }
  return json.data as ApiProvider[];
}

export type ProviderModels = {
  total: number;
  all: string[];
  imageModels: string[];
  chatModels: string[];
  videoModels: string[];
};

export async function testProviderConnection(input: {
  providerId?: string;
  baseUrl: string;
  apiKey?: string;
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
