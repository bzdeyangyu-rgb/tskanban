import type { FlowEdge, FlowNode, FlowNodeType, FlowSnapshot } from "./types";

export type FlowValidationResult = {
  valid: boolean;
  errors: string[];
  order: string[];
};

const executableTypes = new Set<FlowNodeType>([
  "api_text2img",
  "api_img2img",
  "api_inpaint",
  "comfy",
  "llm",
  "video"
]);

const generatorTypes = new Set<FlowNodeType>(["api_text2img", "api_img2img", "api_inpaint", "comfy", "video"]);

export function validateFlowSnapshot(flow: FlowSnapshot): FlowValidationResult {
  const errors: string[] = [];
  const nodeMap = new Map<string, FlowNode>();

  for (const node of flow.nodes) {
    if (nodeMap.has(node.id)) {
      errors.push(`duplicate node id: ${node.id}`);
      continue;
    }
    nodeMap.set(node.id, node);
  }

  for (const edge of flow.edges) {
    if (!nodeMap.has(edge.from)) {
      errors.push(`edge source missing: ${edge.from}`);
    }
    if (!nodeMap.has(edge.to)) {
      errors.push(`edge target missing: ${edge.to}`);
    }
    if (edge.from === edge.to) {
      errors.push(`edge cannot connect node to itself: ${edge.from}`);
    }

    const connectionError = validateConnection(edge, nodeMap);
    if (connectionError) {
      errors.push(connectionError);
    }
  }

  if (!flow.nodes.some((node) => executableTypes.has(node.type))) {
    errors.push("flow must include at least one executable node");
  }

  if (!flow.nodes.some((node) => node.type === "output")) {
    errors.push("flow must include at least one output node");
  }

  const order = topologicalOrder(flow.nodes, flow.edges, errors);

  return {
    valid: errors.length === 0,
    errors,
    order
  };
}

function validateConnection(edge: FlowEdge, nodeMap: Map<string, FlowNode>): string | undefined {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);

  if (!from || !to) {
    return undefined;
  }

  if (from.type === "output" && to.type !== "api_img2img" && to.type !== "api_inpaint" && to.type !== "video") {
    return `output can only feed downstream image/video nodes: output -> ${to.type}`;
  }

  if (to.type === "output") {
    return generatorTypes.has(from.type) ? undefined : `only executable nodes can connect to output: ${from.type} -> output`;
  }

  if (to.type === "api_text2img") {
    return ["prompt", "llm", "loop"].includes(from.type) ? undefined : `invalid text2img input: ${from.type}`;
  }

  if (to.type === "api_img2img") {
    return ["image", "output", "api_text2img", "api_inpaint", "prompt", "llm", "loop"].includes(from.type)
      ? undefined
      : `invalid img2img input: ${from.type}`;
  }

  if (to.type === "api_inpaint") {
    return ["image", "output", "api_text2img", "api_img2img", "prompt", "llm", "loop"].includes(from.type)
      ? undefined
      : `invalid inpaint input: ${from.type}`;
  }

  if (to.type === "comfy" || to.type === "video") {
    return ["image", "output", "api_text2img", "api_img2img", "api_inpaint", "prompt", "llm", "loop"].includes(from.type)
      ? undefined
      : `invalid ${to.type} input: ${from.type}`;
  }

  if (to.type === "llm") {
    return ["prompt", "llm", "loop"].includes(from.type) ? undefined : `invalid llm input: ${from.type}`;
  }

  if (to.type === "loop") {
    return ["prompt", "image", "output", "api_text2img", "api_img2img", "api_inpaint", "llm"].includes(from.type)
      ? undefined
      : `invalid loop input: ${from.type}`;
  }

  return `node type cannot receive input: ${to.type}`;
}

function topologicalOrder(nodes: FlowNode[], edges: FlowEdge[], errors: string[]): string[] {
  const ids = new Set(nodes.map((node) => node.id));
  const indegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const id of ids) {
    indegree.set(id, 0);
    graph.set(id, []);
  }

  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      continue;
    }

    graph.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
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

  if (order.length !== nodes.length) {
    errors.push("flow contains a cycle");
  }

  return order;
}
