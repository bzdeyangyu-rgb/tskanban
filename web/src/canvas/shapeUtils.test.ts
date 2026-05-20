import { describe, expect, it } from "vitest";
import {
  canvasSnapshotToEditorContent,
  createNodeShape,
  mergeNodeData,
  mergeOutputAssets,
  type TshuabuNodeMeta
} from "./shapeUtils";

describe("shape node metadata", () => {
  it("merges edited node data without changing node identity", () => {
    const meta: TshuabuNodeMeta = {
      kind: "tshuabu-node",
      nodeType: "api_img2img",
      title: "Image API",
      data: { model: "m1", strength: 0.5 },
      status: "idle"
    };

    expect(mergeNodeData(meta, { model: "m2", baseAssetId: "asset_1" })).toEqual({
      kind: "tshuabu-node",
      nodeType: "api_img2img",
      title: "Image API",
      data: { model: "m2", strength: 0.5, baseAssetId: "asset_1" },
      status: "idle"
    });
  });

  it("creates custom Tshuabu node shapes", () => {
    const shape = createNodeShape({ type: "prompt", title: "Prompt", data: { text: "hello" } }, 10, 20);

    expect(shape.type).toBe("tshuabu-node");
    expect(shape.meta).toMatchObject({
      kind: "tshuabu-node",
      nodeType: "prompt",
      title: "Prompt"
    });
  });

  it("appends generated assets into output node data", () => {
    expect(
      mergeOutputAssets(
        { outputs: [{ assetId: "old", url: "/outputs/old.png" }] },
        [{ assetId: "new", url: "/outputs/new.png" }]
      )
    ).toEqual({
      outputs: [
        { assetId: "old", url: "/outputs/old.png" },
        { assetId: "new", url: "/outputs/new.png" }
      ]
    });
  });

  it("deduplicates output assets by asset id", () => {
    expect(
      mergeOutputAssets(
        { outputs: [{ assetId: "old", url: "/outputs/old.png" }] },
        [{ assetId: "old", url: "/outputs/old-again.png" }]
      )
    ).toEqual({
      outputs: [{ assetId: "old", url: "/outputs/old.png" }]
    });
  });

  it("converts a saved canvas snapshot back to node shapes and arrow bindings", () => {
    const content = canvasSnapshotToEditorContent({
      canvasId: "c1",
      nodes: [
        { id: "shape:p1", type: "prompt", x: 10, y: 20, width: 240, height: 120, data: { text: "hello" } },
        { id: "shape:g1", type: "api_text2img", x: 320, y: 20, width: 260, height: 150, data: { model: "m1" } }
      ],
      edges: [{ id: "shape:e1", from: "shape:p1", to: "shape:g1" }],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(content.shapes.map((shape) => shape.id)).toEqual(["shape:p1", "shape:g1", "shape:e1"]);
    expect(content.shapes.slice(0, 2).map((shape) => shape.type)).toEqual(["tshuabu-node", "tshuabu-node"]);
    expect(content.bindings.map((binding) => [binding.fromId, binding.toId, binding.props.terminal])).toEqual([
      ["shape:e1", "shape:p1", "start"],
      ["shape:e1", "shape:g1", "end"]
    ]);
  });
});
