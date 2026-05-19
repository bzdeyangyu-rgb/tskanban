import { validateFlowSnapshot } from "./validate";
import type { ExecutableNodeType, FlowNode, FlowSnapshot, NodeExecutionResult } from "./types";

export type CompiledNodeInputs = {
  node: FlowNode;
  upstreamNodes: FlowNode[];
  upstreamResults: NodeExecutionResult[];
};

export type RunnerOutput = {
  outputAssetIds: string[];
  data?: Record<string, unknown> | undefined;
};

export type FlowRunner = (input: CompiledNodeInputs) => Promise<RunnerOutput>;

export type FlowExecutionOptions = {
  sessionId: string;
  targetNodeId?: string | undefined;
  maxRetries?: number | undefined;
  runners: Partial<Record<ExecutableNodeType, FlowRunner>>;
};

export type FlowExecutionResult = {
  ok: boolean;
  error?: string | undefined;
  nodes: NodeExecutionResult[];
};

const executableTypes = new Set<string>(["api_text2img", "api_img2img", "api_inpaint", "comfy", "llm", "video"]);

export async function executeFlowSnapshot(
  flow: FlowSnapshot,
  options: FlowExecutionOptions
): Promise<FlowExecutionResult> {
  const validation = validateFlowSnapshot(flow);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join("; "), nodes: [] };
  }

  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  const results: NodeExecutionResult[] = [];
  const resultsByNodeId = new Map<string, NodeExecutionResult>();
  const maxRetries = options.maxRetries ?? 3;

  for (const nodeId of validation.order) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }

    if (!executableTypes.has(node.type)) {
      const passthrough = createResult({ node, status: "success", attempts: 1, started: Date.now(), outputAssetIds: [] });
      results.push(passthrough);
      resultsByNodeId.set(node.id, passthrough);
      if (node.id === options.targetNodeId) {
        break;
      }
      continue;
    }

    const runner = options.runners[node.type as ExecutableNodeType];
    if (!runner) {
      const failed = createResult({
        node,
        status: "failed",
        attempts: 1,
        started: Date.now(),
        outputAssetIds: [],
        errorMessage: `runner not implemented: ${node.type}`
      });
      results.push(failed);
      return { ok: false, error: failed.errorMessage, nodes: results };
    }

    const started = Date.now();
    let lastError = "";

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const output = await runner(compileNodeInputs(flow, node.id, resultsByNodeId));
        const success = createResult({
          node,
          status: "success",
          attempts: attempt,
          started,
          outputAssetIds: output.outputAssetIds
        });
        results.push(success);
        resultsByNodeId.set(node.id, success);
        lastError = "";
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt === maxRetries) {
          const failed = createResult({
            node,
            status: "failed",
            attempts: attempt,
            started,
            outputAssetIds: [],
            errorMessage: lastError
          });
          results.push(failed);
          resultsByNodeId.set(node.id, failed);
          return { ok: false, error: lastError, nodes: results };
        }
      }
    }

    if (node.id === options.targetNodeId) {
      break;
    }
  }

  return { ok: true, nodes: results };
}

export function compileNodeInputs(
  flow: FlowSnapshot,
  nodeId: string,
  resultsByNodeId: Map<string, NodeExecutionResult>
): CompiledNodeInputs {
  const node = flow.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`node not found: ${nodeId}`);
  }

  const upstreamIds = flow.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
  const upstreamNodes = upstreamIds
    .map((id) => flow.nodes.find((item) => item.id === id))
    .filter((item): item is FlowNode => Boolean(item));

  return {
    node,
    upstreamNodes,
    upstreamResults: upstreamIds
      .map((id) => resultsByNodeId.get(id))
      .filter((item): item is NodeExecutionResult => Boolean(item))
  };
}

function createResult(input: {
  node: FlowNode;
  status: NodeExecutionResult["status"];
  attempts: number;
  started: number;
  outputAssetIds: string[];
  errorMessage?: string | undefined;
}): NodeExecutionResult {
  return {
    nodeId: input.node.id,
    nodeType: input.node.type,
    status: input.status,
    attempts: input.attempts,
    latencyMs: Date.now() - input.started,
    outputAssetIds: input.outputAssetIds,
    errorMessage: input.errorMessage
  };
}
