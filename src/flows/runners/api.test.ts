import { describe, expect, it } from "vitest";
import { createApiFlowRunners } from "./api";
import type { CanvasSession } from "../../services/sessions";
import type { FlowNode } from "../types";

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
        path: "D:/tmp/base.png",
        publicUrl: "/outputs/base.png",
        mime: "image/png",
        size: 10,
        createdAt: "now"
      },
      {
        assetId: "mask1",
        kind: "mask",
        path: "D:/tmp/mask.png",
        publicUrl: "/outputs/mask.png",
        mime: "image/png",
        size: 10,
        createdAt: "now"
      }
    ]
  };
}

describe("api flow runners", () => {
  it("runs text2img from upstream prompt and records generated assets", async () => {
    const calls: unknown[] = [];
    const s = session();
    const runners = createApiFlowRunners({
      session: s,
      generateImage: async (request) => {
        calls.push(request);
        return { outputAssets: ["data:image/png;base64,aGVsbG8="], raw: { ok: true } };
      }
    });

    const result = await runners.api_text2img?.({
      node: node("g1", "api_text2img", { model: "m1", params: { steps: 12 } }),
      upstreamNodes: [node("p1", "prompt", { text: "hello prompt" })],
      upstreamResults: []
    });

    expect(calls).toEqual([
      {
        action: "text2img",
        model: "m1",
        prompt: "hello prompt",
        negativePrompt: undefined,
        params: { steps: 12 }
      }
    ]);
    expect(result?.outputAssetIds).toHaveLength(1);
    expect(result?.outputAssets?.[0]?.url).toMatch(/^\/outputs\//);
    expect(s.assets).toHaveLength(3);
    expect(s.versions[0]?.action).toBe("text2img");
  });

  it("runs inpaint with base and mask assets from node data", async () => {
    const calls: unknown[] = [];
    const s = session();
    const runners = createApiFlowRunners({
      session: s,
      generateImage: async (request) => {
        calls.push(request);
        return { outputAssets: ["https://example.com/out.png"], raw: { ok: true } };
      }
    });

    const result = await runners.api_inpaint?.({
      node: node("g1", "api_inpaint", { model: "m1", baseAssetId: "base1", maskAssetId: "mask1" }),
      upstreamNodes: [node("p1", "prompt", { text: "paint here" })],
      upstreamResults: []
    });

    expect(calls).toEqual([
      {
        action: "inpaint",
        model: "m1",
        prompt: "paint here",
        negativePrompt: undefined,
        params: undefined,
        inputImage: "D:/tmp/base.png",
        maskImage: "D:/tmp/mask.png"
      }
    ]);
    expect(result?.outputAssets?.[0]).toEqual(expect.objectContaining({ url: "https://example.com/out.png" }));
    expect(s.versions[0]?.action).toBe("inpaint");
  });

  it("runs img2img with an upstream image asset", async () => {
    const calls: unknown[] = [];
    const s = session();
    const runners = createApiFlowRunners({
      session: s,
      generateImage: async (request) => {
        calls.push(request);
        return { outputAssets: ["https://example.com/img2img.png"], raw: { ok: true } };
      }
    });

    await runners.api_img2img?.({
      node: node("g1", "api_img2img", { model: "m1", params: { strength: 0.4 } }),
      upstreamNodes: [node("img1", "image", { assetId: "base1" }), node("p1", "prompt", { text: "restyle" })],
      upstreamResults: []
    });

    expect(calls).toEqual([
      {
        action: "img2img",
        model: "m1",
        prompt: "restyle",
        negativePrompt: undefined,
        params: { strength: 0.4 },
        inputImage: "D:/tmp/base.png"
      }
    ]);
    expect(s.versions[0]?.action).toBe("img2img");
  });
});
