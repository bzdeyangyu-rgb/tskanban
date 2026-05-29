import { describe, expect, it } from "vitest";
import type { CanvasNode } from "./flowTypes";
import {
  canvasPanViewport,
  canvasShortcutAllowed,
  linkReleaseAction,
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
