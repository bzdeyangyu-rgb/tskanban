import { describe, expect, it } from "vitest";
import { compileShapesToSnapshot } from "./flowCompiler";

describe("compileShapesToSnapshot", () => {
  it("converts tldraw node shapes and bound arrows into a backend flow snapshot", () => {
    const snapshot = compileShapesToSnapshot({
      canvasId: "c1",
      sessionId: "s1",
      shapes: [
        {
          id: "shape:p1",
          type: "geo",
          x: 10,
          y: 20,
          meta: { kind: "tshuabu-node", nodeType: "prompt", title: "Prompt", data: { text: "hello" }, status: "idle" },
          props: { w: 240, h: 120 }
        },
        {
          id: "shape:g1",
          type: "geo",
          x: 300,
          y: 20,
          meta: { kind: "tshuabu-node", nodeType: "api_text2img", title: "文生图", data: { model: "fake" } },
          props: { w: 260, h: 150 }
        },
        {
          id: "shape:o1",
          type: "geo",
          x: 600,
          y: 20,
          meta: { kind: "tshuabu-node", nodeType: "output", title: "Output", data: {} },
          props: { w: 260, h: 180 }
        },
        { id: "shape:e1", type: "arrow", x: 0, y: 0, meta: {}, props: {} },
        { id: "shape:e2", type: "arrow", x: 0, y: 0, meta: {}, props: {} }
      ],
      arrowEndpoints: {
        "shape:e1": { start: "shape:p1", end: "shape:g1" },
        "shape:e2": { start: "shape:g1", end: "shape:o1" }
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: "shape:g1"
    });

    expect(snapshot.nodes.map((node) => [node.id, node.type])).toEqual([
      ["shape:p1", "prompt"],
      ["shape:g1", "api_text2img"],
      ["shape:o1", "output"]
    ]);
    expect(snapshot.edges).toEqual([
      { id: "shape:e1", from: "shape:p1", to: "shape:g1" },
      { id: "shape:e2", from: "shape:g1", to: "shape:o1" }
    ]);
    expect(snapshot.selectedNodeId).toBe("shape:g1");
  });

  it("ignores arrows that are not bound to two Tshuabu nodes", () => {
    const snapshot = compileShapesToSnapshot({
      canvasId: "c1",
      shapes: [
        {
          id: "shape:p1",
          type: "geo",
          x: 10,
          y: 20,
          meta: { kind: "tshuabu-node", nodeType: "prompt", title: "Prompt", data: {} },
          props: { w: 240, h: 120 }
        },
        { id: "shape:e1", type: "arrow", x: 0, y: 0, meta: {}, props: {} }
      ],
      arrowEndpoints: {
        "shape:e1": { start: "shape:p1" }
      },
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    expect(snapshot.edges).toEqual([]);
  });
});
