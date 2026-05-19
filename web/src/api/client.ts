import type { CanvasSnapshot } from "../canvas/flowTypes";

export type FlowExecutionNode = {
  nodeId: string;
  nodeType: string;
  status: string;
  attempts: number;
  latencyMs: number;
  outputAssetIds: string[];
  errorMessage?: string;
};

export type FlowExecutionResponse = {
  sessionId: string;
  flowId: string;
  nodes: FlowExecutionNode[];
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
