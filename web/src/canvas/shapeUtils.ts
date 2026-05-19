import { createShapeId, toRichText, type Editor, type TLShapePartial, type TLGeoShape } from "tldraw";
import type { CanvasNodeKind, CanvasNodeStatus } from "./flowTypes";

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

export function createNodeShape(definition: NodeDefinition, x: number, y: number): TLShapePartial<TLGeoShape> {
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
    id: createShapeId(),
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
