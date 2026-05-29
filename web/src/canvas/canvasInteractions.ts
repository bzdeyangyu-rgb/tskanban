import type { CanvasNode, CanvasNodeKind } from "./flowTypes";

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
