import type { CanvasEdge, CanvasNode, CanvasNodeKind } from "./flowTypes";

export type CanvasViewport = { x: number; y: number; zoom: number };
export type CanvasPoint = { x: number; y: number };
export type EditableTarget = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

export type LinkReleaseAction =
  | { type: "connect"; fromId: string; toId: string }
  | { type: "menu"; fromId: string; fromType: CanvasNodeKind; canvasX: number; canvasY: number };

export function canvasShortcutAllowed(target: EditableTarget | null | undefined): boolean {
  if (!target) {
    return true;
  }

  if (typeof target.closest === "function" && target.closest("input, textarea, select, [contenteditable='true']")) {
    return false;
  }

  const tagName = target.tagName?.toUpperCase();
  return !target.isContentEditable && tagName !== "INPUT" && tagName !== "TEXTAREA" && tagName !== "SELECT";
}

export function canvasPanViewport(
  viewport: CanvasViewport,
  drag: { startX: number; startY: number; clientX: number; clientY: number }
): CanvasViewport {
  return {
    ...viewport,
    x: viewport.x + drag.clientX - drag.startX,
    y: viewport.y + drag.clientY - drag.startY
  };
}

export function nodePositionFromViewport(
  viewport: CanvasViewport,
  viewportSize: { width: number; height: number },
  nodeSize: { width: number; height: number }
): CanvasPoint {
  return {
    x: (viewportSize.width / 2 - viewport.x) / viewport.zoom - nodeSize.width / 2,
    y: (viewportSize.height / 2 - viewport.y) / viewport.zoom - nodeSize.height / 2
  };
}

export function cloneSelectedSubgraph(
  graph: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] },
  selectedIds: readonly string[],
  offset: CanvasPoint,
  ids: { nodePrefix: string; edgePrefix: string } = {
    nodePrefix: `node_${Date.now().toString(36)}`,
    edgePrefix: `edge_${Date.now().toString(36)}`
  }
): { nodes: CanvasNode[]; edges: CanvasEdge[]; idMap: Map<string, string> } {
  const selected = new Set(selectedIds);
  const idMap = new Map<string, string>();
  const selectedNodes = graph.nodes.filter((node) => selected.has(node.id));

  for (const node of selectedNodes) {
    idMap.set(node.id, `${ids.nodePrefix}_${node.id}`);
  }

  return {
    nodes: selectedNodes.map((node) => ({
      ...node,
      id: idMap.get(node.id) ?? node.id,
      x: node.x + offset.x,
      y: node.y + offset.y,
      data: { ...node.data },
      status: "idle"
    })),
    edges: graph.edges
      .filter((edge) => selected.has(edge.from) && selected.has(edge.to))
      .map((edge) => ({
        id: `${ids.edgePrefix}_${edge.id}`,
        from: idMap.get(edge.from) ?? edge.from,
        to: idMap.get(edge.to) ?? edge.to
      })),
    idMap
  };
}

export function nodeIdsInSelection(nodes: readonly CanvasNode[], start: CanvasPoint, end: CanvasPoint): string[] {
  const rect = normalizedRect(start.x, start.y, end.x, end.y);
  return nodes.filter((node) => rectIntersectsNode(rect, node)).map((node) => node.id);
}

export function resizeNodeFromBottomRight(
  node: CanvasNode,
  options: { dx: number; dy: number; minWidth: number; minHeight: number }
): CanvasNode {
  return {
    ...node,
    width: Math.max(options.minWidth, node.width + options.dx),
    height: Math.max(options.minHeight, node.height + options.dy)
  };
}

export function linkReleaseAction(
  source: { fromId: string; fromType: CanvasNodeKind },
  targetNodeId: string | undefined,
  canvasPoint: CanvasPoint
): LinkReleaseAction {
  if (targetNodeId && targetNodeId !== source.fromId) {
    return { type: "connect", fromId: source.fromId, toId: targetNodeId };
  }

  return {
    type: "menu",
    fromId: source.fromId,
    fromType: source.fromType,
    canvasX: canvasPoint.x,
    canvasY: canvasPoint.y
  };
}

function normalizedRect(x1: number, y1: number, x2: number, y2: number): { left: number; top: number; right: number; bottom: number } {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2)
  };
}

function rectIntersectsNode(
  rect: { left: number; top: number; right: number; bottom: number },
  node: Pick<CanvasNode, "x" | "y" | "width" | "height">
): boolean {
  const nodeRect = {
    left: node.x,
    top: node.y,
    right: node.x + node.width,
    bottom: node.y + node.height
  };
  return rect.left <= nodeRect.right && rect.right >= nodeRect.left && rect.top <= nodeRect.bottom && rect.bottom >= nodeRect.top;
}
