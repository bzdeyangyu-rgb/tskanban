import { describe, expect, it } from "vitest";
import { buildImageApiCall } from "../src/imageApi";
import { createApiFlowRunners } from "../src/flows/runners/api";
import type { CanvasSession } from "../src/services/sessions";
import type { FlowNode } from "../src/flows/types";

function node(id: string, type: FlowNode["type"], data: Record<string, unknown> = {}): FlowNode {
  return { id, type, x: 0, y: 0, width: 240, height: 140, data };
}

function session(): CanvasSession {
  return {
    sessionId: "s1",
    createdAt: "now",
    updatedAt: "now",
    versions: [],
    assets: [
      {
        assetId: "base1",
        kind: "base",
        path: "data:image/png;base64,BASE",
        publicUrl: "/outputs/base.png",
        mime: "image/png",
        size: 10,
        createdAt: "now"
      },
      {
        assetId: "mask1",
        kind: "mask",
        path: "data:image/png;base64,MASK",
        publicUrl: "/outputs/mask.png",
        mime: "image/png",
        size: 10,
        createdAt: "now"
      }
    ]
  };
}

describe("图像 API payload 构造", () => {
  it("text2img 走生成接口且不携带参考图", () => {
    const call = buildImageApiCall({
      request: {
        action: "text2img",
        model: "gpt-image-2",
        prompt: "生成一张产品图",
        params: { size: "1024x1024" }
      },
      baseUrl: "https://example.test/v1",
      protocol: "openai"
    });

    expect(call.url).toBe("https://example.test/v1/images/generations");
    expect(call.payload).toMatchObject({
      model: "gpt-image-2",
      prompt: "生成一张产品图",
      size: "1024x1024"
    });
    expect(call.payload).not.toHaveProperty("images");
    expect(call.payload).not.toHaveProperty("image");
    expect(call.payload).not.toHaveProperty("input_image");
    expect(call.payload).not.toHaveProperty("mask");
  });

  it("img2img 走编辑接口且必须携带参考图", () => {
    const call = buildImageApiCall({
      request: {
        action: "img2img",
        model: "gpt-image-2",
        prompt: "保持构图，改变风格",
        params: { size: "1024x1024", strength: 0.45 },
        inputImage: "data:image/png;base64,IMG"
      },
      baseUrl: "https://example.test/v1",
      protocol: "openai"
    });

    expect(call.url).toBe("https://example.test/v1/images/edits");
    expect(call.payload).toMatchObject({
      prompt: "保持构图，改变风格",
      images: [{ image_url: "data:image/png;base64,IMG" }],
      strength: 0.45
    });
  });

  it("img2img 缺少参考图时拒绝构造请求", () => {
    expect(() =>
      buildImageApiCall({
        request: {
          action: "img2img",
          model: "gpt-image-2",
          prompt: "保持构图，改变风格"
        },
        baseUrl: "https://example.test/v1",
        protocol: "openai"
      })
    ).toThrow(/img2img.*input image/i);
  });

  it("inpaint 走编辑接口且必须携带原图和 mask", () => {
    const call = buildImageApiCall({
      request: {
        action: "inpaint",
        model: "gpt-image-2",
        prompt: "替换局部背景",
        inputImage: "data:image/png;base64,SOURCE",
        maskImage: "data:image/png;base64,MASK"
      },
      baseUrl: "https://example.test/v1",
      protocol: "openai"
    });

    expect(call.url).toBe("https://example.test/v1/images/edits");
    expect(call.payload).toMatchObject({
      images: [{ image_url: "data:image/png;base64,SOURCE" }],
      mask: { image_url: "data:image/png;base64,MASK" }
    });
  });

  it("inpaint 缺少原图或 mask 时拒绝构造请求", () => {
    expect(() =>
      buildImageApiCall({
        request: {
          action: "inpaint",
          model: "gpt-image-2",
          prompt: "替换局部背景",
          inputImage: "data:image/png;base64,SOURCE"
        },
        baseUrl: "https://example.test/v1",
        protocol: "openai"
      })
    ).toThrow(/inpaint.*mask/i);
  });
});

describe("图像 API runner 追踪字段", () => {
  it("记录 mode/provider/model/inputAssetIds/outputAssetIds/latency", async () => {
    const s = session();
    const runners = createApiFlowRunners({
      session: s,
      flowId: "flow-1",
      getProvider: async () => ({
        id: "provider-1",
        name: "示例供应商",
        baseUrl: "https://example.test/v1",
        protocol: "openai"
      }),
      generateImage: async () => ({ outputAssets: ["https://example.test/out.png"], raw: { ok: true } })
    });

    const result = await runners.api_inpaint?.({
      node: node("api-1", "api_inpaint", {
        model: "image-model",
        providerId: "provider-1",
        baseAssetId: "base1",
        maskAssetId: "mask1"
      }),
      upstreamNodes: [node("prompt-1", "prompt", { text: "替换背景" })],
      upstreamResults: []
    });

    expect(result?.data).toMatchObject({
      mode: "inpaint",
      providerId: "provider-1",
      model: "image-model",
      inputAssetIds: ["base1", "mask1"],
      outputAssetIds: result?.outputAssetIds
    });
    expect(typeof result?.data?.latencyMs).toBe("number");
    expect(s.versions[0]).toMatchObject({
      action: "inpaint",
      providerId: "provider-1",
      model: "image-model",
      parentAssetIds: ["base1", "mask1"],
      outputAssetIds: result?.outputAssetIds
    });
    expect(typeof s.versions[0]?.latencyMs).toBe("number");
  });
});
