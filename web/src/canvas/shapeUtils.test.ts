import { describe, expect, it } from "vitest";
import { mergeNodeData, type TshuabuNodeMeta } from "./shapeUtils";

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
});
