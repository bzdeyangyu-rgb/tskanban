import { describe, expect, it } from "vitest";
import type { CanvasNode } from "./flowTypes";
import {
  collectDragNodeIds,
  deleteCanvasSelection,
  importWorkflowGeneToCanvas,
  moveCanvasNodes,
  promptGeneSourceFromNodes,
  generatorNodeInputSummary,
  mergeOutputAssets,
  selectedOutputAssetFromNode,
  upstreamNodesFor,
  workflowGeneSourceFromSelection
} from "./ReferenceCanvas";

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

  it("uses selected prompt before newest prompt for gene capture", () => {
    const promptNodes: CanvasNode[] = [
      { id: "old", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: { text: "旧提示词" }, status: "idle" },
      { id: "image", type: "image", x: 0, y: 0, width: 100, height: 100, data: {}, status: "idle" },
      { id: "new", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: { text: "新提示词" }, status: "idle" }
    ];

    expect(promptGeneSourceFromNodes(promptNodes, ["old"])).toEqual({ prompt: "旧提示词", sourceNodeId: "old" });
    expect(promptGeneSourceFromNodes(promptNodes, [])).toEqual({ prompt: "新提示词", sourceNodeId: "new" });
  });

  it("summarizes connected generator inputs from prompts, images, and outputs", () => {
    const canvasNodes: CanvasNode[] = [
      { id: "p", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: { text: "上游提示词" } },
      { id: "img", type: "image", x: 0, y: 0, width: 100, height: 100, data: { assetId: "asset_base", url: "/base.png", name: "base.png" } },
      {
        id: "out",
        type: "output",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        data: { outputs: [{ assetId: "asset_out", url: "/out.png" }] }
      },
      { id: "g", type: "api_text2img", x: 0, y: 0, width: 100, height: 100, data: {} }
    ];
    const upstream = upstreamNodesFor(canvasNodes, [
      { id: "e1", from: "p", to: "g" },
      { id: "e2", from: "img", to: "g" },
      { id: "e3", from: "out", to: "g" }
    ], "g");

    expect(generatorNodeInputSummary(canvasNodes[3], upstream)).toEqual({
      prompt: "上游提示词",
      promptSource: "p",
      images: [
        { assetId: "asset_base", url: "/base.png", name: "base.png", sourceNodeId: "img" },
        { assetId: "asset_out", url: "/out.png", name: "asset_out", sourceNodeId: "out" }
      ]
    });
  });

  it("uses connected prompt nodes before stale generator prompt data", () => {
    const summary = generatorNodeInputSummary(
      { id: "g", type: "api_text2img", x: 0, y: 0, width: 100, height: 100, data: { prompt: "旧节点提示词" } },
      [{ id: "p", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: { text: "上游提示词" } }]
    );

    expect(summary.prompt).toBe("上游提示词");
    expect(summary.promptSource).toBe("p");
  });

  it("merges output assets without duplicating existing results", () => {
    const next = mergeOutputAssets(
      [{ assetId: "a1", url: "/a1.png" }],
      [
        { assetId: "a1", url: "/a1-new.png" },
        { assetId: "a2", url: "/a2.png" }
      ]
    );

    expect(next).toEqual([
      { assetId: "a1", url: "/a1.png" },
      { assetId: "a2", url: "/a2.png" }
    ]);
  });

  it("reads the selected output asset before falling back to the latest result", () => {
    const outputNode: CanvasNode = {
      id: "out",
      type: "output",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      data: {
        selectedOutputAssetId: "a1",
        outputs: [
          { assetId: "a1", url: "/a1.png" },
          { assetId: "a2", url: "/a2.png" }
        ]
      }
    };

    expect(selectedOutputAssetFromNode(outputNode)).toEqual({ assetId: "a1", url: "/a1.png" });
    expect(selectedOutputAssetFromNode({ ...outputNode, data: { outputs: outputNode.data.outputs } })).toEqual({
      assetId: "a2",
      url: "/a2.png"
    });
  });

  it("captures selected nodes and internal edges as a workflow gene", () => {
    const result = workflowGeneSourceFromSelection(
      [
        { id: "p", type: "prompt", x: 10, y: 20, width: 100, height: 100, data: { text: "提示词" } },
        { id: "g", type: "api_text2img", x: 150, y: 20, width: 120, height: 120, data: { model: "m" } },
        { id: "o", type: "output", x: 310, y: 20, width: 120, height: 120, data: {} }
      ],
      [
        { id: "e1", from: "p", to: "g" },
        { id: "e2", from: "g", to: "o" }
      ],
      ["p", "g"]
    );

    expect(result?.snapshot.nodes.map((node) => node.id)).toEqual(["p", "g"]);
    expect(result?.snapshot.edges).toEqual([{ id: "e1", from: "p", to: "g" }]);
  });

  it("can include connected output nodes when saving a workflow gene", () => {
    const result = workflowGeneSourceFromSelection(
      [
        { id: "p", type: "prompt", x: 10, y: 20, width: 100, height: 100, data: { text: "提示词" } },
        { id: "g", type: "api_text2img", x: 150, y: 20, width: 120, height: 120, data: { model: "m" } },
        { id: "o", type: "output", x: 310, y: 20, width: 120, height: 120, data: {} },
        { id: "other", type: "prompt", x: 470, y: 20, width: 120, height: 120, data: {} }
      ],
      [
        { id: "e1", from: "p", to: "g" },
        { id: "e2", from: "g", to: "o" },
        { id: "e3", from: "o", to: "other" }
      ],
      ["p", "g"],
      "selectionWithOutputs"
    );

    expect(result?.snapshot.nodes.map((node) => node.id)).toEqual(["p", "g", "o"]);
    expect(result?.snapshot.edges).toEqual([
      { id: "e1", from: "p", to: "g" },
      { id: "e2", from: "g", to: "o" }
    ]);
  });

  it("can save the whole canvas as a workflow gene", () => {
    const result = workflowGeneSourceFromSelection(
      [
        { id: "p", type: "prompt", x: 10, y: 20, width: 100, height: 100, data: { text: "提示词" } },
        { id: "g", type: "api_text2img", x: 150, y: 20, width: 120, height: 120, data: { model: "m" } },
        { id: "o", type: "output", x: 310, y: 20, width: 120, height: 120, data: {} }
      ],
      [
        { id: "e1", from: "p", to: "g" },
        { id: "e2", from: "g", to: "o" }
      ],
      [],
      "canvas"
    );

    expect(result?.snapshot.nodes.map((node) => node.id)).toEqual(["p", "g", "o"]);
    expect(result?.snapshot.edges).toHaveLength(2);
  });

  it("imports workflow genes with fresh node and edge ids", () => {
    const result = importWorkflowGeneToCanvas(
      [{ id: "existing", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: {} }],
      [],
      {
        canvasId: "gene",
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "p", type: "prompt", x: 10, y: 20, width: 100, height: 100, data: { text: "提示词" } },
          { id: "g", type: "api_text2img", x: 150, y: 20, width: 120, height: 120, data: {} }
        ],
        edges: [{ id: "e1", from: "p", to: "g" }]
      },
      "gene_new",
      40
    );

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toEqual([{ id: "gene_new_edge_0", from: "gene_new_node_0", to: "gene_new_node_1" }]);
    expect(result.importedIds).toEqual(["gene_new_node_0", "gene_new_node_1"]);
  });

  it("centers imported workflow genes around the requested point", () => {
    const result = importWorkflowGeneToCanvas(
      [],
      [],
      {
        canvasId: "gene",
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "a", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: {} },
          { id: "b", type: "api_text2img", x: 200, y: 0, width: 100, height: 100, data: {} }
        ],
        edges: []
      },
      "centered",
      { targetCenter: { x: 500, y: 300 } }
    );

    expect(result.nodes[0]).toMatchObject({ x: 350, y: 250 });
    expect(result.nodes[1]).toMatchObject({ x: 550, y: 250 });
  });

  it("shifts imported workflow genes away from overlapping nodes", () => {
    const result = importWorkflowGeneToCanvas(
      [{ id: "existing", type: "prompt", x: 350, y: 250, width: 100, height: 100, data: {} }],
      [],
      {
        canvasId: "gene",
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [{ id: "a", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: {} }],
        edges: []
      },
      "avoid",
      { targetCenter: { x: 400, y: 300 }, avoidOverlap: true }
    );

    expect(result.nodes[1].x).toBeGreaterThan(350);
    expect(result.nodes[1].y).toBeGreaterThan(250);
  });
});
