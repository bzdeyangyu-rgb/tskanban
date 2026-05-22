import { describe, expect, it } from "vitest";
import type { CanvasNode } from "./flowTypes";
import { collectDragNodeIds, deleteCanvasSelection, moveCanvasNodes } from "./ReferenceCanvas";

const nodes: CanvasNode[] = [
  { id: "a", type: "image", x: 10, y: 20, width: 100, height: 80, data: {} },
  { id: "b", type: "prompt", x: 140, y: 30, width: 120, height: 90, data: {} },
  { id: "g", type: "group", x: 0, y: 0, width: 300, height: 160, data: { childIds: ["a", "b"] } }
];

describe("ReferenceCanvas model helpers", () => {
  it("drags group children with the group frame", () => {
    expect(collectDragNodeIds(nodes, ["g"], "g")).toEqual(["g", "a", "b"]);
  });

  it("moves every collected node by the same delta", () => {
    const moved = moveCanvasNodes(nodes, ["g", "a", "b"], 15, -5);

    expect(moved.find((node) => node.id === "g")).toMatchObject({ x: 15, y: -5 });
    expect(moved.find((node) => node.id === "a")).toMatchObject({ x: 25, y: 15 });
    expect(moved.find((node) => node.id === "b")).toMatchObject({ x: 155, y: 25 });
  });

  it("deletes a selected edge without deleting nodes", () => {
    const result = deleteCanvasSelection(nodes, [{ id: "e1", from: "a", to: "b" }], [], "e1");

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toEqual([]);
  });
});
