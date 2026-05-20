import {
  createBindingId,
  createShapeId,
  toRichText,
  type Editor,
  type TLArrowBinding,
  type TLArrowShape,
  type TLBindingCreate,
  type TLGeoShape,
  type TLImageShape,
  type TLShapeId,
  type TLShapePartial
} from "tldraw";
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

const NODE_COLORS: Record<CanvasNodeKind, TLGeoShape["props"]["color"]> = {
  image: "blue",
  prompt: "green",
  api_text2img: "violet",
  api_img2img: "orange",
  api_inpaint: "red",
  output: "black",
  comfy: "light-violet",
  llm: "light-blue",
  loop: "yellow",
  video: "light-red"
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

export function createNodeShape(definition: NodeDefinition, x: number, y: number, id?: TLShapeId): TLShapePartial<TLGeoShape> {
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
    type: "geo",
    x,
    y,
    meta,
    props: {
      geo: "rectangle",
      w: width,
      h: height,
      color: NODE_COLORS[definition.type],
      fill: "semi",
      dash: "solid",
      size: "m",
      font: "sans",
      align: "middle",
      verticalAlign: "middle",
      labelColor: "black",
      richText: toRichText(`${definition.title}\n${definition.type}`),
      growY: 0,
      scale: 1,
      url: ""
    }
  };
}

export function addNodeToEditor(editor: Editor, definition: NodeDefinition, placementIndex: number): string {
  const bounds = editor.getViewportPageBounds();
  const x = bounds.x + 80 + (placementIndex % 3) * 300;
  const y = bounds.y + 80 + Math.floor(placementIndex / 3) * 190;
  const shape = createNodeShape(definition, x, y);

  editor.createShape(shape);
  if (shape.id) {
    editor.select(shape.id);
  }
  editor.setCurrentTool("select");
  return String(shape.id);
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

export function canvasSnapshotToEditorContent(snapshot: CanvasSnapshot): {
  shapes: Array<TLShapePartial<TLGeoShape> | TLShapePartial<TLArrowShape>>;
  bindings: TLBindingCreate<TLArrowBinding>[];
} {
  const shapes: Array<TLShapePartial<TLGeoShape> | TLShapePartial<TLArrowShape>> = snapshot.nodes.map((node) => {
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

function toShapeId(id: string): TLShapeId {
  return id.startsWith("shape:") ? (id as TLShapeId) : createShapeId(id);
}

function stripRecordPrefix(id: string): string {
  return id.replace(/^[a-z]+:/, "");
}
