import { describe, expect, it } from "vitest";
import { canvasExecuteSchema, canvasSnapshotSchema, img2imgSchema } from "./contracts";

describe("canvas snapshot contracts", () => {
  it("accepts the phase-one node types and reserved future node types", () => {
    const snapshot = canvasSnapshotSchema.parse({
      canvasId: "c_1",
      sessionId: "s_1",
      nodes: [
        {
          id: "img_1",
          type: "image",
          x: 40,
          y: 80,
          width: 240,
          height: 180,
          data: { assetId: "a_1" }
        },
        {
          id: "prompt_1",
          type: "prompt",
          x: 320,
          y: 80,
          width: 260,
          height: 140,
          data: { text: "clean product photo" }
        },
        {
          id: "text2img_1",
          type: "api_text2img",
          x: 620,
          y: 80,
          width: 260,
          height: 150,
          data: { model: "test-model" }
        },
        {
          id: "img2img_1",
          type: "api_img2img",
          x: 620,
          y: 270,
          width: 260,
          height: 150,
          data: { strength: 0.55 }
        },
        {
          id: "inpaint_1",
          type: "api_inpaint",
          x: 620,
          y: 460,
          width: 260,
          height: 150,
          data: { maskAssetId: "m_1" }
        },
        {
          id: "output_1",
          type: "output",
          x: 940,
          y: 80,
          width: 300,
          height: 220,
          data: {}
        },
        { id: "comfy_1", type: "comfy", x: 0, y: 0, width: 260, height: 150, data: {} },
        { id: "llm_1", type: "llm", x: 0, y: 0, width: 260, height: 150, data: {} },
        { id: "loop_1", type: "loop", x: 0, y: 0, width: 260, height: 150, data: {} },
        { id: "video_1", type: "video", x: 0, y: 0, width: 260, height: 150, data: {} }
      ],
      edges: [
        { id: "e_1", from: "prompt_1", to: "text2img_1", fromHandle: "out", toHandle: "prompt" },
        { id: "e_2", from: "text2img_1", to: "output_1" }
      ],
      viewport: { x: 10, y: -20, zoom: 0.8 },
      selectedNodeId: "text2img_1"
    });

    expect(snapshot.nodes.map((node) => node.type)).toEqual([
      "image",
      "prompt",
      "api_text2img",
      "api_img2img",
      "api_inpaint",
      "output",
      "comfy",
      "llm",
      "loop",
      "video"
    ]);
    expect(snapshot.nodes[0]?.data).toEqual({ assetId: "a_1" });
    expect(snapshot.edges[0]?.fromHandle).toBe("out");
    expect(snapshot.viewport.zoom).toBe(0.8);
  });

  it("wraps a canvas snapshot for execution requests", () => {
    const request = canvasExecuteSchema.parse({
      sessionId: "s_1",
      targetNodeId: "output_1",
      flow: {
        canvasId: "c_1",
        nodes: [
          { id: "prompt_1", type: "prompt", x: 0, y: 0, width: 240, height: 120, data: { text: "x" } },
          { id: "text2img_1", type: "api_text2img", x: 280, y: 0, width: 260, height: 150, data: {} }
        ],
        edges: [{ id: "e_1", from: "prompt_1", to: "text2img_1" }],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    });

    expect(request.flow.canvasId).toBe("c_1");
    expect(request.targetNodeId).toBe("output_1");
  });

  it("accepts img2img API relay requests", () => {
    const request = img2imgSchema.parse({
      sessionId: "s_1",
      parentVersionId: "v_1",
      baseAssetId: "asset_base",
      prompt: "keep composition, warmer light",
      negativePrompt: "blur",
      model: "image-model",
      params: { strength: 0.45 }
    });

    expect(request.baseAssetId).toBe("asset_base");
    expect(request.params?.strength).toBe(0.45);
  });
});
