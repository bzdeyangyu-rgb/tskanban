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

  const snapshot = {
    canvasId: input.canvasId,
    sessionId: input.sessionId,
    nodes,
    edges,
    viewport: input.viewport,
    selectedNodeId: input.selectedNodeId
  };
  return normalizeGeneratorInputs(snapshot);
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

function normalizeGeneratorInputs(snapshot: CanvasSnapshot): CanvasSnapshot {
  const nodeMap = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const normalizedNodes = snapshot.nodes.map((node) => {
    if (!["api_img2img", "api_inpaint", "video", "api_text2img"].includes(node.type)) {
      return node;
    }

    const upstreamNodes = snapshot.edges
      .filter((edge) => edge.to === node.id)
      .map((edge) => nodeMap.get(edge.from))
      .filter((upstream): upstream is CanvasNode => Boolean(upstream));
    const prompt = promptFromUpstream(upstreamNodes);
    const images = upstreamNodes.flatMap(imageAssetsFromNode);
    const [firstImage] = images;
    const inputAssetIds = images.map((image) => image.assetId);

    return {
      ...node,
      data: {
        ...node.data,
        ...(prompt ? { prompt } : {}),
        ...(firstImage && node.type !== "api_text2img" ? { baseAssetId: firstImage.assetId } : {}),
        ...(inputAssetIds.length ? { inputAssetIds } : {})
      }
    };
  });

  return { ...snapshot, nodes: normalizedNodes };
}

function promptFromUpstream(nodes: CanvasNode[]): string {
  const promptNode = nodes.find((node) => ["prompt", "loop", "llm"].includes(node.type));
  if (!promptNode) {
    return "";
  }
  return stringValue(promptNode.data.text || promptNode.data.prompt).trim();
}

function imageAssetsFromNode(node: CanvasNode): Array<{ assetId: string; url?: string }> {
  if (node.type === "image") {
    const assetId = stringValue(node.data.assetId);
    return assetId ? [{ assetId, url: stringValue(node.data.url) || undefined }] : [];
  }

  if (node.type === "output" && Array.isArray(node.data.outputs)) {
    const selectedOutputAssetId = stringValue(node.data.selectedOutputAssetId);
    const outputs = node.data.outputs.filter(isOutputAsset);
    const selected = selectedOutputAssetId ? outputs.find((asset) => asset.assetId === selectedOutputAssetId) : undefined;
    return selected ? [selected] : outputs.slice(-1);
  }

  return [];
}

function stringValue(value: unknown): string {
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

function isOutputAsset(value: unknown): value is { assetId: string; url: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { assetId?: unknown }).assetId === "string" &&
      typeof (value as { url?: unknown }).url === "string"
  );
}
