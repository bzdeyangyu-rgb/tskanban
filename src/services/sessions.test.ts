import { describe, expect, it } from "vitest";
import { appendRunRecord, appendVersion, traceAssetProvenance, type CanvasSession } from "./sessions";
import type { FlowSnapshot, NodeExecutionResult } from "../flows/types";

function session(): CanvasSession {
  return {
    sessionId: "s1",
    createdAt: "now",
    updatedAt: "now",
    versions: [],
    assets: []
  };
}

function flow(): FlowSnapshot {
  return {
    canvasId: "c1",
    sessionId: "s1",
    nodes: [
      { id: "p1", type: "prompt", x: 0, y: 0, width: 200, height: 120, data: { text: "a cat" } },
      {
        id: "g1",
        type: "api_img2img",
        x: 260,
        y: 0,
        width: 240,
        height: 140,
        data: { providerId: "miku", model: "gpt-image-2" }
      }
    ],
    edges: [{ id: "e1", from: "p1", to: "g1" }],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

describe("session provenance", () => {
  it("stores node, provider, parent asset, and run provenance on versions", () => {
    const s = session();
    const version = appendVersion(s, {
      action: "img2img",
      model: "gpt-image-2",
      prompt: "a cat",
      params: { strength: 0.5 },
      providerId: "miku",
      sourceNodeId: "g1",
      sourceRunId: "run_1",
      parentAssetIds: ["base1"],
      baseAssetId: "base1",
      outputAssetIds: ["out1"],
      selectedOutputAssetId: "out1",
      latencyMs: 88,
      status: "success"
    });

    expect(version).toMatchObject({
      versionId: "v_0001",
      providerId: "miku",
      sourceNodeId: "g1",
      sourceRunId: "run_1",
      parentAssetIds: ["base1"],
      outputAssetIds: ["out1"]
    });
  });

  it("appends a full canvas run record for later history and RAG replay", () => {
    const s = session();
    const nodeResults: NodeExecutionResult[] = [
      {
        nodeId: "p1",
        nodeType: "prompt",
        status: "success",
        attempts: 1,
        latencyMs: 0,
        outputAssetIds: []
      },
      {
        nodeId: "g1",
        nodeType: "api_img2img",
        status: "success",
        attempts: 1,
        latencyMs: 88,
        inputAssetIds: ["base1"],
        outputAssetIds: ["out1"],
        outputAssets: [{ assetId: "out1", url: "/outputs/out1.png" }],
        data: {
          versionId: "v_0001",
          providerId: "miku",
          model: "gpt-image-2",
          prompt: "a cat",
          parentAssetIds: ["base1"]
        }
      }
    ];

    const record = appendRunRecord(s, {
      runId: "run_1",
      flowId: "flow_1",
      canvasId: "c1",
      snapshot: flow(),
      status: "success",
      startedAt: "2026-05-20T00:00:00.000Z",
      completedAt: "2026-05-20T00:00:01.000Z",
      latencyMs: 1000,
      nodes: nodeResults
    });

    expect(record.outputAssetIds).toEqual(["out1"]);
    expect(record.nodes[1]).toMatchObject({
      nodeId: "g1",
      providerId: "miku",
      model: "gpt-image-2",
      prompt: "a cat",
      inputAssetIds: ["base1"],
      outputAssetIds: ["out1"],
      versionId: "v_0001"
    });
    expect(s.runs?.[0]?.snapshot.nodes.map((node) => node.id)).toEqual(["p1", "g1"]);
  });

  it("traces a generated asset back through parent assets and versions", () => {
    const s = session();
    appendVersion(s, {
      action: "text2img",
      model: "gpt-image-2",
      prompt: "base cat",
      params: {},
      providerId: "miku",
      sourceNodeId: "txt1",
      sourceRunId: "run_1",
      parentAssetIds: [],
      outputAssetIds: ["base_out"],
      selectedOutputAssetId: "base_out",
      latencyMs: 50,
      status: "success"
    });
    appendVersion(s, {
      action: "img2img",
      model: "gpt-image-2",
      prompt: "make it cinematic",
      params: { strength: 0.45 },
      providerId: "miku",
      sourceNodeId: "img2",
      sourceRunId: "run_2",
      parentAssetIds: ["base_out"],
      baseAssetId: "base_out",
      outputAssetIds: ["final_out"],
      selectedOutputAssetId: "final_out",
      latencyMs: 70,
      status: "success"
    });

    const trace = traceAssetProvenance(s, "final_out");

    expect(trace.assetId).toBe("final_out");
    expect(trace.chain.map((item) => [item.assetId, item.versionId, item.sourceNodeId, item.prompt])).toEqual([
      ["final_out", "v_0002", "img2", "make it cinematic"],
      ["base_out", "v_0001", "txt1", "base cat"]
    ]);
  });
});
