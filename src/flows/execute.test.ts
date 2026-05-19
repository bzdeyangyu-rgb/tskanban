import { describe, expect, it } from "vitest";
import { executeFlowSnapshot } from "./execute";
import type { FlowSnapshot } from "./types";

function baseFlow(): FlowSnapshot {
  return {
    canvasId: "c1",
    sessionId: "s1",
    nodes: [
      { id: "p1", type: "prompt", x: 0, y: 0, width: 240, height: 120, data: { text: "hello" } },
      { id: "g1", type: "api_text2img", x: 280, y: 0, width: 260, height: 150, data: { model: "fake" } },
      { id: "o1", type: "output", x: 580, y: 0, width: 260, height: 180, data: {} }
    ],
    edges: [
      { id: "e1", from: "p1", to: "g1" },
      { id: "e2", from: "g1", to: "o1" }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

describe("executeFlowSnapshot", () => {
  it("runs nodes in validation order and returns each node status", async () => {
    const calls: string[] = [];
    const result = await executeFlowSnapshot(baseFlow(), {
      sessionId: "s1",
      runners: {
        api_text2img: async (input) => {
          calls.push(input.node.id);
          expect(input.upstreamNodes.map((node) => node.id)).toEqual(["p1"]);
          return { outputAssetIds: ["a_out"], data: { url: "/outputs/a_out.png" } };
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["g1"]);
    expect(result.nodes.map((node) => [node.nodeId, node.status])).toEqual([
      ["p1", "success"],
      ["g1", "success"],
      ["o1", "success"]
    ]);
    expect(result.nodes.find((node) => node.nodeId === "g1")?.outputAssetIds).toEqual(["a_out"]);
  });

  it("retries failed executable nodes and records attempts", async () => {
    let attempts = 0;
    const result = await executeFlowSnapshot(baseFlow(), {
      sessionId: "s1",
      maxRetries: 3,
      runners: {
        api_text2img: async () => {
          attempts += 1;
          if (attempts < 3) {
            throw new Error("temporary failure");
          }
          return { outputAssetIds: ["a_retry"], data: {} };
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.nodes.find((node) => node.nodeId === "g1")?.attempts).toBe(3);
    expect(result.nodes.find((node) => node.nodeId === "g1")?.status).toBe("success");
  });

  it("stops on a failed executable node and returns prior node statuses", async () => {
    const result = await executeFlowSnapshot(baseFlow(), {
      sessionId: "s1",
      maxRetries: 2,
      runners: {
        api_text2img: async () => {
          throw new Error("provider down");
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("provider down");
    expect(result.nodes.map((node) => [node.nodeId, node.status])).toEqual([
      ["p1", "success"],
      ["g1", "failed"]
    ]);
    expect(result.nodes.find((node) => node.nodeId === "g1")?.attempts).toBe(2);
  });

  it("returns validation errors without running nodes", async () => {
    const result = await executeFlowSnapshot(
      {
        ...baseFlow(),
        edges: [{ id: "bad", from: "missing", to: "g1" }]
      },
      {
        sessionId: "s1",
        runners: {
          api_text2img: async () => ({ outputAssetIds: ["never"], data: {} })
        }
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("edge source missing: missing");
    expect(result.nodes).toEqual([]);
  });
});
