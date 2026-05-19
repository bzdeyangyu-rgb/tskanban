import { describe, expect, it } from "vitest";
import { validateFlowSnapshot } from "./validate";
import type { FlowSnapshot } from "./types";

function node(id: string, type: FlowSnapshot["nodes"][number]["type"], data: Record<string, unknown> = {}) {
  return { id, type, x: 0, y: 0, width: 240, height: 140, data };
}

describe("validateFlowSnapshot", () => {
  it("accepts prompt to api text2img to output", () => {
    const result = validateFlowSnapshot({
      canvasId: "c1",
      nodes: [node("p1", "prompt", { text: "a clean product photo" }), node("g1", "api_text2img"), node("o1", "output")],
      edges: [
        { id: "e1", from: "p1", to: "g1" },
        { id: "e2", from: "g1", to: "o1" }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.order).toEqual(["p1", "g1", "o1"]);
  });

  it("accepts image and prompt inputs for img2img and inpaint generator nodes", () => {
    const result = validateFlowSnapshot({
      canvasId: "c1",
      nodes: [
        node("img1", "image", { assetId: "a1" }),
        node("prompt1", "prompt", { text: "keep structure" }),
        node("img2img1", "api_img2img"),
        node("inpaint1", "api_inpaint"),
        node("out1", "output")
      ],
      edges: [
        { id: "e1", from: "img1", to: "img2img1" },
        { id: "e2", from: "prompt1", to: "img2img1" },
        { id: "e3", from: "img2img1", to: "inpaint1" },
        { id: "e4", from: "prompt1", to: "inpaint1" },
        { id: "e5", from: "inpaint1", to: "out1" }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(result.valid).toBe(true);
    expect(result.order).toEqual(["img1", "prompt1", "img2img1", "inpaint1", "out1"]);
  });

  it("rejects edges that reference missing nodes", () => {
    const result = validateFlowSnapshot({
      canvasId: "c1",
      nodes: [node("p1", "prompt"), node("g1", "api_text2img"), node("o1", "output")],
      edges: [
        { id: "e1", from: "missing", to: "g1" },
        { id: "e2", from: "g1", to: "o1" }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("edge source missing: missing");
  });

  it("rejects invalid direct connections to output", () => {
    const result = validateFlowSnapshot({
      canvasId: "c1",
      nodes: [node("img1", "image"), node("o1", "output")],
      edges: [{ id: "e1", from: "img1", to: "o1" }],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("only executable nodes can connect to output");
  });

  it("rejects cyclic flows", () => {
    const result = validateFlowSnapshot({
      canvasId: "c1",
      nodes: [node("p1", "prompt"), node("g1", "api_text2img"), node("o1", "output")],
      edges: [
        { id: "e1", from: "p1", to: "g1" },
        { id: "e2", from: "g1", to: "o1" },
        { id: "e3", from: "o1", to: "p1" }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("flow contains a cycle");
  });

  it("rejects flows without executable and output nodes", () => {
    const result = validateFlowSnapshot({
      canvasId: "c1",
      nodes: [node("p1", "prompt"), node("img1", "image")],
      edges: [{ id: "e1", from: "p1", to: "img1" }],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("flow must include at least one executable node");
    expect(result.errors.join("\n")).toContain("flow must include at least one output node");
  });
});
