export type CanvasNodeKind =
  | "image"
  | "prompt"
  | "api_text2img"
  | "api_img2img"
  | "api_inpaint"
  | "output"
  | "comfy"
  | "llm"
  | "loop"
  | "video"
  | "group";

export type CanvasNodeStatus = "idle" | "queued" | "running" | "success" | "failed" | "retrying";

export type CanvasNode = {
  id: string;
  type: CanvasNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Record<string, unknown>;
  status?: CanvasNodeStatus;
};

export type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  fromHandle?: string;
  toHandle?: string;
};

export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasSnapshot = {
  canvasId: string;
  sessionId?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: CanvasViewport;
  selectedNodeId?: string;
  createdAt?: string;
  updatedAt?: string;
};
