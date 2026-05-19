export type FlowNodeType =
  | "image"
  | "prompt"
  | "api_text2img"
  | "api_img2img"
  | "api_inpaint"
  | "output"
  | "comfy"
  | "llm"
  | "loop"
  | "video";

export type FlowNodeStatus = "idle" | "queued" | "running" | "success" | "failed" | "retrying";

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Record<string, unknown>;
  status?: FlowNodeStatus | undefined;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  fromHandle?: string | undefined;
  toHandle?: string | undefined;
};

export type FlowViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type FlowSnapshot = {
  canvasId: string;
  sessionId?: string | undefined;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: FlowViewport;
  selectedNodeId?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

export type ExecutableNodeType = "api_text2img" | "api_img2img" | "api_inpaint" | "comfy" | "llm" | "video";

export type NodeExecutionResult = {
  nodeId: string;
  nodeType: FlowNodeType;
  status: FlowNodeStatus;
  attempts: number;
  latencyMs: number;
  outputAssetIds: string[];
  errorMessage?: string | undefined;
};
