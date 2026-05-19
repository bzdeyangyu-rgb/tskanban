import { getArrowBindings, type Editor, type TLArrowShape, type TLShape } from "tldraw";
import type { CanvasEdge, CanvasNode, CanvasSnapshot } from "./flowTypes";
import { isTshuabuNodeMeta } from "./shapeUtils";

type ArrowEndpoint = {
  start?: string;
  end?: string;
};

export type CompileInputShape = Pick<TLShape, "id" | "type" | "x" | "y" | "meta"> & {
  props: Record<string, unknown>;
};

export function compileShapesToSnapshot(input: {
  canvasId: string;
  sessionId?: string;
  shapes: CompileInputShape[];
  arrowEndpoints: Record<string, ArrowEndpoint>;
  viewport: { x: number; y: number; zoom: number };
  selectedNodeId?: string;
}): CanvasSnapshot {
  const nodeIds = new Set<string>();
  const nodes: CanvasNode[] = [];

  for (const shape of input.shapes) {
    if (!isTshuabuNodeMeta(shape.meta)) {
      continue;
    }

    nodeIds.add(String(shape.id));
    nodes.push({
      id: String(shape.id),
      type: shape.meta.nodeType,
      x: shape.x,
      y: shape.y,
      width: numberProp(shape.props.w, 260),
      height: numberProp(shape.props.h, 140),
      data: shape.meta.data,
      status: shape.meta.status
    });
  }

  const edges: CanvasEdge[] = [];
  for (const shape of input.shapes) {
    if (shape.type !== "arrow") {
      continue;
    }

    const endpoints = input.arrowEndpoints[String(shape.id)];
    if (!endpoints?.start || !endpoints.end) {
      continue;
    }

    if (!nodeIds.has(endpoints.start) || !nodeIds.has(endpoints.end)) {
      continue;
    }

    edges.push({
      id: String(shape.id),
      from: endpoints.start,
      to: endpoints.end
    });
  }

  return {
    canvasId: input.canvasId,
    sessionId: input.sessionId,
    nodes,
    edges,
    viewport: input.viewport,
    selectedNodeId: input.selectedNodeId
  };
}

export function compileCanvasSnapshot(editor: Editor, canvasId: string, sessionId?: string): CanvasSnapshot {
  const shapes = editor.getCurrentPageShapes();
  const camera = editor.getCamera();
  const selectedNodeId = editor.getSelectedShapeIds().find((id) => {
    const shape = editor.getShape(id);
    return isTshuabuNodeMeta(shape?.meta);
  });

  return compileShapesToSnapshot({
    canvasId,
    sessionId,
    shapes: shapes as CompileInputShape[],
    arrowEndpoints: getArrowEndpoints(editor, shapes),
    viewport: {
      x: camera.x,
      y: camera.y,
      zoom: camera.z
    },
    selectedNodeId: selectedNodeId ? String(selectedNodeId) : undefined
  });
}

function getArrowEndpoints(editor: Editor, shapes: TLShape[]): Record<string, ArrowEndpoint> {
  const endpoints: Record<string, ArrowEndpoint> = {};

  for (const shape of shapes) {
    if (shape.type !== "arrow") {
      continue;
    }

    const bindings = getArrowBindings(editor, shape as TLArrowShape);
    endpoints[String(shape.id)] = {
      start: bindings.start ? String(bindings.start.toId) : undefined,
      end: bindings.end ? String(bindings.end.toId) : undefined
    };
  }

  return endpoints;
}

function numberProp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
