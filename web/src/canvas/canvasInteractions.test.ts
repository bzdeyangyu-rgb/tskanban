import { describe, expect, it } from "vitest";
import type { CanvasNode } from "./flowTypes";
import {
  canvasPanViewport,
  canvasShortcutAllowed,
  cloneSelectedSubgraph,
  linkReleaseAction,
  nodePositionFromViewport,
  nodeIdsInSelection,
  resizeNodeFromBottomRight
} from "./canvasInteractions";

const sampleNodes: CanvasNode[] = [
  { id: "a", type: "image", x: 20, y: 30, width: 120, height: 90, data: {} },
  { id: "b", type: "prompt", x: 220, y: 60, width: 140, height: 120, data: {} },
  { id: "c", type: "output", x: 520, y: 80, width: 160, height: 120, data: {} }
];

describe("canvas interactions", () => {
  it("does not allow Delete or Backspace shortcuts while editing text", () => {
    expect(canvasShortcutAllowed({ tagName: "INPUT" })).toBe(false);
    expect(canvasShortcutAllowed({ tagName: "TEXTAREA" })).toBe(false);
    expect(canvasShortcutAllowed({ tagName: "SELECT" })).toBe(false);
    expect(canvasShortcutAllowed({ tagName: "DIV", isContentEditable: true })).toBe(false);
    expect(canvasShortcutAllowed({ tagName: "DIV" })).toBe(true);
  });

  it("pans the blank canvas by the raw pointer delta", () => {
    expect(canvasPanViewport({ x: 80, y: 40, zoom: 0.75 }, { startX: 100, startY: 120, clientX: 144, clientY: 86 })).toEqual({
      x: 124,
      y: 6,
      zoom: 0.75
    });
  });

  it("places new nodes at the viewport center", () => {
    expect(nodePositionFromViewport({ x: -400, y: -300, zoom: 1 }, { width: 1200, height: 800 }, { width: 260, height: 180 })).toEqual({
      x: 870,
      y: 610
    });
  });

  it("copies selected nodes with internal edges and offsets pasted nodes", () => {
    const result = cloneSelectedSubgraph(
      {
        nodes: [
          { id: "p1", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: {} },
          { id: "g1", type: "api_text2img", x: 160, y: 0, width: 100, height: 100, data: {} },
          { id: "out", type: "output", x: 320, y: 0, width: 100, height: 100, data: {} }
        ],
        edges: [
          { id: "e1", from: "p1", to: "g1" },
          { id: "e2", from: "g1", to: "out" }
        ]
      },
      ["p1", "g1"],
      { x: 40, y: 40 },
      { nodePrefix: "copy", edgePrefix: "copyEdge" }
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toEqual([{ id: "copyEdge_e1", from: "copy_p1", to: "copy_g1" }]);
    expect(result.nodes[0]).toMatchObject({ id: "copy_p1", x: 40, y: 40 });
    expect(result.nodes[1]).toMatchObject({ id: "copy_g1", x: 200, y: 40 });
  });

  it("selects every node touched by a ctrl drag rectangle in canvas coordinates", () => {
    expect(nodeIdsInSelection(sampleNodes, { x: 0, y: 0 }, { x: 380, y: 190 })).toEqual(["a", "b"]);
  });

  it("keeps bottom-right resize handles inside the node by preserving the top-left corner", () => {
    const resized = resizeNodeFromBottomRight(sampleNodes[0], { dx: 60, dy: 30, minWidth: 220, minHeight: 126 });

    expect(resized).toMatchObject({ x: 20, y: 30, width: 220, height: 126 });
  });

  it("creates an edge when a link is released on another node", () => {
    expect(linkReleaseAction({ fromId: "a", fromType: "image" }, "b", { x: 10, y: 20 })).toEqual({
      type: "connect",
      fromId: "a",
      toId: "b"
    });
  });

  it("opens the command menu when a link is released on blank canvas", () => {
    expect(linkReleaseAction({ fromId: "a", fromType: "image" }, undefined, { x: 320, y: 180 })).toEqual({
      type: "menu",
      fromId: "a",
      fromType: "image",
      canvasX: 320,
      canvasY: 180
    });
  });
});
