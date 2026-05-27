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
    expect(s.versions[0]).toMatchObject({
      sourceNodeId: "g1",
      parentAssetIds: []
    });
    expect(result?.data).toMatchObject({
      versionId: "v_0001",
      model: "m1",
      prompt: "hello prompt",
      parentAssetIds: []
    });
  });

  it("merges canvas generator controls into image request params", async () => {
    const calls: unknown[] = [];
    const runners = createApiFlowRunners({
      session: session(),
      generateImage: async (request) => {
        calls.push(request);
        return { outputAssets: ["data:image/png;base64,aGVsbG8="], raw: { ok: true } };
      }
    });

    await runners.api_text2img?.({
      node: node("g1", "api_text2img", {
        model: "m1",
        resolution: "custom",
        ratio: "wide",
        count: 3,
        customWidth: "1536",
        customHeight: "864",
        params: { seed: "42", steps: 12 }
      }),
      upstreamNodes: [node("p1", "prompt", { text: "hello prompt" })],
      upstreamResults: []
    });

    expect(calls[0]).toMatchObject({
      params: {
        resolution: "custom",
        ratio: "wide",
        count: 3,
        width: 1536,
        height: 864,
        seed: "42",
        steps: 12
      }
    });
  });

  it("prefers connected prompt nodes over stale generator prompt data", async () => {
    const calls: unknown[] = [];
    const runners = createApiFlowRunners({
      session: session(),
      generateImage: async (request) => {
        calls.push(request);
        return { outputAssets: ["data:image/png;base64,aGVsbG8="], raw: { ok: true } };
      }
    });

    await runners.api_text2img?.({
      node: node("g1", "api_text2img", { model: "m1", prompt: "旧节点提示词" }),
      upstreamNodes: [node("p1", "prompt", { text: "连线提示词" })],
      upstreamResults: []
    });

    expect(calls[0]).toMatchObject({ prompt: "连线提示词" });
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
    expect(s.versions[0]).toMatchObject({
      sourceNodeId: "g1",
      parentAssetIds: ["base1", "mask1"]
    });
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
    expect(s.versions[0]).toMatchObject({
      sourceNodeId: "g1",
      parentAssetIds: ["base1"]
    });
  });

  it("runs img2img with the selected asset from an upstream output node", async () => {
    const calls: unknown[] = [];
    const s = session();
    const runners = createApiFlowRunners({
      session: s,
      generateImage: async (request) => {
        calls.push(request);
        return { outputAssets: ["https://example.com/output-reference.png"], raw: { ok: true } };
      }
    });

    await runners.api_img2img?.({
      node: node("g1", "api_img2img", { model: "m1" }),
      upstreamNodes: [
        node("out1", "output", {
          selectedOutputAssetId: "base1",
          outputs: [{ assetId: "base1", url: "/outputs/base.png" }]
        }),
        node("p1", "prompt", { text: "continue this image" })
      ],
      upstreamResults: []
    });

    expect(calls[0]).toMatchObject({
      action: "img2img",
      inputImage: "D:/tmp/base.png"
    });
    expect(s.versions[0]).toMatchObject({
      action: "img2img",
      parentAssetIds: ["base1"]
    });
  });
});
