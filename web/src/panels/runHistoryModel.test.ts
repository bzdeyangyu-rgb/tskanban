import { describe, expect, it } from "vitest";
import { buildRunHistoryModel, findRunById } from "./runHistoryModel";
import type { CanvasSession } from "../api/client";

function session(): CanvasSession {
  return {
    sessionId: "s1",
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:02.000Z",
    currentVersionId: "v_0002",
    versions: [
      {
        versionId: "v_0001",
        sourceRunId: "run_1",
        sourceNodeId: "g1",
        action: "text2img",
        model: "m1",
        prompt: "first",
        outputAssetIds: ["asset_1"],
        status: "success"
      },
      {
        versionId: "v_0002",
        sourceRunId: "run_2",
        sourceNodeId: "g2",
        action: "img2img",
        model: "m2",
        prompt: "second",
        outputAssetIds: ["asset_2", "asset_3"],
        status: "success"
      }
    ],
    runs: [
      {
        runId: "run_1",
        flowId: "flow_1",
        canvasId: "c1",
        status: "success",
        startedAt: "2026-05-20T00:00:00.000Z",
        completedAt: "2026-05-20T00:00:01.000Z",
        latencyMs: 100,
        nodes: [],
        outputAssetIds: ["asset_1"]
      },
      {
        runId: "run_2",
        flowId: "flow_2",
        canvasId: "c1",
        status: "failed",
        startedAt: "2026-05-20T00:00:01.000Z",
        completedAt: "2026-05-20T00:00:02.000Z",
        latencyMs: 200,
        nodes: [],
        outputAssetIds: ["asset_2"]
      }
    ]
  };
}

describe("run history model", () => {
  it("orders recent runs and versions first", () => {
    const model = buildRunHistoryModel(session());

    expect(model.runs.map((run) => run.runId)).toEqual(["run_2", "run_1"]);
    expect(model.versions.map((version) => version.versionId)).toEqual(["v_0002", "v_0001"]);
  });

  it("selects the latest run and newest output asset by default", () => {
    const model = buildRunHistoryModel(session());

    expect(model.defaultRunId).toBe("run_2");
    expect(model.defaultAssetId).toBe("asset_2");
    expect(model.outputAssetIds).toEqual(["asset_2", "asset_3", "asset_1"]);
  });

  it("finds a run by id", () => {
    const model = buildRunHistoryModel(session());

    expect(findRunById(model, "run_1")?.flowId).toBe("flow_1");
    expect(findRunById(model, "missing")).toBeUndefined();
  });
});
