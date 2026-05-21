import {
  createBindingId,
  createShapeId,
  type Editor,
  type TLArrowBinding,
  type TLArrowShape,
  type TLBindingCreate,
  type TLImageShape,
  type TLShapeId,
  type TLShapePartial
} from "tldraw";
import type { TshuabuNodeShape } from "./TshuabuNodeShapeUtil";
import type { CanvasNodeKind, CanvasNodeStatus } from "./flowTypes";
import type { CanvasSnapshot } from "./flowTypes";

export type TshuabuNodeMeta = {
  kind: "tshuabu-node";
  nodeType: CanvasNodeKind;
  title: string;
  data: Record<string, unknown>;
  status?: CanvasNodeStatus;
};

export type NodeDefinition = {
  type: CanvasNodeKind;
  title: string;
  data?: Record<string, unknown>;
  width?: number;
  height?: number;
};

export function isTshuabuNodeMeta(meta: unknown): meta is TshuabuNodeMeta {
  if (!meta || typeof meta !== "object") {
    return false;
  }

  const candidate = meta as Partial<TshuabuNodeMeta>;
  return candidate.kind === "tshuabu-node" && typeof candidate.nodeType === "string" && typeof candidate.title === "string";
}

export function mergeNodeData(meta: TshuabuNodeMeta, patch: Record<string, unknown>): TshuabuNodeMeta {
  return {
    ...meta,
    data: {
      ...meta.data,
      ...patch
    }
  };
}

export function createNodeShape(definition: NodeDefinition, x: number, y: number, id?: TLShapeId): TLShapePartial<TshuabuNodeShape> {
  const width = definition.width ?? 260;
  const height = definition.height ?? 140;
  const meta: TshuabuNodeMeta = {
    kind: "tshuabu-node",
    nodeType: definition.type,
    title: definition.title,
    data: definition.data ?? {},
    status: "idle"
  };

  return {
    id: id ?? createShapeId(),
    type: "tshuabu-node",
    x,
    y,
    meta,
    props: {
      w: width,
      h: height
    }
  };
}

export function addNodeToEditor(editor: Editor, definition: NodeDefinition, placementIndex: number): string {
  const bounds = editor.getViewportPageBounds();
  const x = bounds.x + 80 + (placementIndex % 3) * 300;
  const y = bounds.y + 80 + Math.floor(placementIndex / 3) * 190;
  return addNodeToEditorAt(editor, definition, x, y);
}

export function addNodeToEditorAt(editor: Editor, definition: NodeDefinition, x: number, y: number): string {
  const shape = createNodeShape(definition, x, y);

  editor.createShape(shape);
  if (shape.id) {
    editor.select(shape.id);
  }
  editor.setCurrentTool("select");
  return String(shape.id);
}

export function connectNodes(editor: Editor, fromId: string, toId: string): string | undefined {
  const fromShape = editor.getShape(fromId as TLShapeId);
  const toShape = editor.getShape(toId as TLShapeId);
  if (!fromShape || !toShape) {
    return undefined;
  }

  const fromSize = nodeShapeSize(fromShape);
  const toSize = nodeShapeSize(toShape);
  const arrowId = createShapeId();
  editor.createShape<TLArrowShape>({
    id: arrowId,
    type: "arrow",
    x: fromShape.x + fromSize.w,
    y: fromShape.y + fromSize.h / 2,
    props: {
      kind: "arc",
      labelColor: "black",
      color: "white",
      fill: "none",
      dash: "solid",
      size: "m",
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      font: "sans",
      start: { x: 0, y: 0 },
      end: {
        x: Math.max(96, toShape.x - fromShape.x - fromSize.w),
        y: toShape.y + toSize.h / 2 - (fromShape.y + fromSize.h / 2)
      },
      bend: 0,
      text: "",
      labelPosition: 0.5,
      scale: 1,
      elbowMidPoint: 0.5
    }
  });

  editor.createBindings<TLArrowBinding>([
    {
      id: createBindingId(`${stripRecordPrefix(String(arrowId))}-start`),
      type: "arrow",
      fromId: arrowId,
      toId: fromShape.id,
      props: {
        terminal: "start",
        normalizedAnchor: { x: 1, y: 0.5 },
        isExact: false,
        isPrecise: false
      }
    },
    {
      id: createBindingId(`${stripRecordPrefix(String(arrowId))}-end`),
      type: "arrow",
      fromId: arrowId,
      toId: toShape.id,
      props: {
        terminal: "end",
        normalizedAnchor: { x: 0, y: 0.5 },
        isExact: false,
        isPrecise: false
      }
    }
  ]);

  return String(arrowId);
}

export function addOutputImagesToEditor(
  editor: Editor,
  outputs: Array<{ assetId: string; url: string }>
): void {
  if (outputs.length === 0) {
    return;
  }

  const bounds = editor.getViewportPageBounds();
  const shapes = outputs.map((output, index): TLShapePartial<TLImageShape> => ({
    id: createShapeId(),
    type: "image",
    x: bounds.x + 120 + index * 280,
    y: bounds.y + 360,
    meta: {
      kind: "tshuabu-output",
      assetId: output.assetId
    },
    props: {
      w: 240,
      h: 240,
      url: output.url,
      assetId: null,
      crop: null,
      flipX: false,
      flipY: false,
      playing: true,
      altText: output.assetId
    }
  }));

  editor.createShapes(shapes);
  editor.select(...shapes.map((shape) => shape.id).filter(Boolean));
  editor.setCurrentTool("select");
}

export function mergeOutputAssets(
  data: Record<string, unknown>,
  assets: Array<{ assetId: string; url: string }>
): Record<string, unknown> {
  const existing = Array.isArray(data.outputs) ? data.outputs : [];
  const seen = new Set(existing.map((item) => (isOutputAsset(item) ? item.assetId : "")));
  const outputs = [...existing];

  for (const asset of assets) {
    if (seen.has(asset.assetId)) {
      continue;
    }
    outputs.push(asset);
    seen.add(asset.assetId);
  }

  return { ...data, outputs };
}

export function updateNodeStatuses(
  editor: Editor,
  nodes: Array<{ nodeId: string; status: CanvasNodeStatus; errorMessage?: string }>
): void {
  for (const node of nodes) {
    const shape = editor.getShape(node.nodeId as TLShapeId);
    if (!shape || !isTshuabuNodeMeta(shape.meta)) {
      continue;
    }

    editor.updateShape({
      id: shape.id,
      type: shape.type,
      meta: {
        ...shape.meta,
        status: node.status,
        data: node.errorMessage ? { ...shape.meta.data, errorMessage: node.errorMessage } : shape.meta.data
      }
    });
  }
}

export function addOutputsToOutputNode(editor: Editor, assets: Array<{ assetId: string; url: string }>): boolean {
  if (assets.length === 0) {
    return false;
  }

  const outputShape = editor
    .getCurrentPageShapes()
    .find((shape) => isTshuabuNodeMeta(shape.meta) && shape.meta.nodeType === "output");
  if (!outputShape || !isTshuabuNodeMeta(outputShape.meta)) {
    return false;
  }

  editor.updateShape({
    id: outputShape.id,
    type: outputShape.type,
    meta: {
      ...outputShape.meta,
      status: "success",
      data: mergeOutputAssets(outputShape.meta.data, assets)
    }
  });
  editor.select(outputShape.id);
  return true;
}

export function selectedOutputAsset(editor: Editor): { assetId: string; url: string } | undefined {
  const selected = editor
    .getSelectedShapeIds()
    .map((id) => editor.getShape(id))
    .find((shape) => isTshuabuNodeMeta(shape?.meta) && shape.meta.nodeType === "output");

  if (!selected || !isTshuabuNodeMeta(selected.meta)) {
    return undefined;
  }

  const outputs = Array.isArray(selected.meta.data.outputs) ? selected.meta.data.outputs : [];
  const last = outputs[outputs.length - 1];
  return isOutputAsset(last) ? last : undefined;
}

export function canvasSnapshotToEditorContent(snapshot: CanvasSnapshot): {
  shapes: Array<TLShapePartial<TshuabuNodeShape> | TLShapePartial<TLArrowShape>>;
  bindings: TLBindingCreate<TLArrowBinding>[];
} {
  const shapes: Array<TLShapePartial<TshuabuNodeShape> | TLShapePartial<TLArrowShape>> = snapshot.nodes.map((node) => {
    const shape = createNodeShape(
      {
        type: node.type,
        title: titleForNode(node.type),
        data: node.data,
        width: node.width,
        height: node.height
      },
      node.x,
      node.y,
      toShapeId(node.id)
    );
    return {
      ...shape,
      meta: {
        ...(shape.meta as TshuabuNodeMeta),
        status: node.status ?? "idle"
      }
    };
  });

  const bindings: TLBindingCreate<TLArrowBinding>[] = [];

  for (const edge of snapshot.edges) {
    const from = snapshot.nodes.find((node) => node.id === edge.from);
    const to = snapshot.nodes.find((node) => node.id === edge.to);
    if (!from || !to) {
      continue;
    }

    const arrowId = toShapeId(edge.id);
    shapes.push({
      id: arrowId,
      type: "arrow",
      x: from.x + from.width,
      y: from.y + from.height / 2,
      props: {
        kind: "arc",
        labelColor: "black",
        color: "black",
        fill: "none",
        dash: "solid",
        size: "m",
        arrowheadStart: "none",
        arrowheadEnd: "arrow",
        font: "sans",
        start: { x: 0, y: 0 },
        end: { x: Math.max(80, to.x - from.x), y: to.y - from.y },
        bend: 0,
        text: "",
        labelPosition: 0.5,
        scale: 1,
        elbowMidPoint: 0.5
      }
    });

    bindings.push(
      {
        id: createBindingId(`${stripRecordPrefix(edge.id)}-start`),
        type: "arrow",
        fromId: arrowId,
        toId: toShapeId(edge.from),
        props: {
          terminal: "start",
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
          isPrecise: false
        }
      },
      {
        id: createBindingId(`${stripRecordPrefix(edge.id)}-end`),
        type: "arrow",
        fromId: arrowId,
        toId: toShapeId(edge.to),
        props: {
          terminal: "end",
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
          isPrecise: false
        }
      }
    );
  }

  return { shapes, bindings };
}

export function restoreCanvasSnapshot(editor: Editor, snapshot: CanvasSnapshot): void {
  const current = editor.getCurrentPageShapes();
  if (current.length > 0) {
    editor.deleteShapes(current.map((shape) => shape.id));
  }

  const content = canvasSnapshotToEditorContent(snapshot);
  if (content.shapes.length > 0) {
    editor.createShapes(content.shapes);
  }
  if (content.bindings.length > 0) {
    editor.createBindings(content.bindings);
  }
  editor.setCamera({ x: snapshot.viewport.x, y: snapshot.viewport.y, z: snapshot.viewport.zoom });
  if (snapshot.selectedNodeId) {
    editor.select(toShapeId(snapshot.selectedNodeId));
  }
  editor.setCurrentTool("select");
}

function titleForNode(type: CanvasNodeKind): string {
  const labels: Partial<Record<CanvasNodeKind, string>> = {
    image: "图片节点",
    prompt: "Prompt",
    api_text2img: "文生图 API",
    api_img2img: "图生图 API",
    api_inpaint: "局部重绘 API",
    video: "视频 API",
    output: "Output"
  };
  return labels[type] ?? type;

  switch (type) {
    case "image":
      return "图片节点";
    case "prompt":
      return "Prompt";
    case "api_text2img":
      return "文生图 API";
    case "api_img2img":
      return "图生图 API";
    case "api_inpaint":
      return "局部重绘 API";
    case "video":
      return "视频 API";
    case "output":
      return "Output";
    default:
      return type;
  }
}

function nodeShapeSize(shape: { props?: unknown }): { w: number; h: number } {
  const props = shape.props as { w?: unknown; h?: unknown } | undefined;
  return {
    w: typeof props?.w === "number" ? props.w : 260,
    h: typeof props?.h === "number" ? props.h : 160
  };
}

function toShapeId(id: string): TLShapeId {
  return id.startsWith("shape:") ? (id as TLShapeId) : createShapeId(id);
}

function stripRecordPrefix(id: string): string {
  return id.replace(/^[a-z]+:/, "");
}

function isOutputAsset(value: unknown): value is { assetId: string; url: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { assetId?: unknown }).assetId === "string" &&
      typeof (value as { url?: unknown }).url === "string"
  );
}
