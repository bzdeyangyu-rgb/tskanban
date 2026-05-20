import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeFlowSnapshot } from "./flows/execute";
import type { FlowSnapshot } from "./flows/types";
import { filterEvents, type RagEvent } from "./logger";
import { loadCanvas, saveCanvas } from "./services/canvases";
import { appendRunRecord, appendVersion, traceAssetProvenance, type CanvasSession } from "./services/sessions";

const canvasId = "c_phase_one_closure";
const sessionId = "s_phase_one_closure";
const canvasPath = path.join(process.cwd(), "logs", "canvases", `${canvasId}.json`);

function phaseOneFlow(): FlowSnapshot {
  return {
    canvasId,
    sessionId,
    nodes: [
      { id: "img1", type: "image", x: 0, y: 0, width: 220, height: 150, data: { assetId: "asset_base" } },
      { id: "prompt1", type: "prompt", x: 0, y: 210, width: 220, height: 120, data: { text: "cinematic product shot" } },
      {
        id: "img2img1",
        type: "api_img2img",
        x: 300,
        y: 80,
        width: 260,
        height: 150,
        data: { providerId: "fake-provider", model: "fake-image-model" }
      },
      { id: "out1", type: "output", x: 640, y: 80, width: 260, height: 180, data: {} }
    ],
    edges: [
      { id: "e_img", from: "img1", to: "img2img1" },
      { id: "e_prompt", from: "prompt1", to: "img2img1" },
      { id: "e_out", from: "img2img1", to: "out1" }
    ],
    viewport: { x: -80, y: 24, zoom: 0.85 },
    selectedNodeId: "img2img1"
  };
}

function session(): CanvasSession {
  return {
    sessionId,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    versions: [],
    assets: []
  };
}

describe("phase one closure", () => {
  afterEach(async () => {
    await rm(canvasPath, { force: true });
  });

  it("keeps one canvas run replayable across execution, versions, RAG filters, and canvas restore", async () => {
    const flow = phaseOneFlow();
    const s = session();
    const runId = "run_phase_one";

    const result = await executeFlowSnapshot(flow, {
      sessionId,
      runners: {
        api_img2img: async ({ node, upstreamNodes }) => {
          const prompt = upstreamNodes.find((item) => item.type === "prompt")?.data.text;
          const baseAssetId = upstreamNodes.find((item) => item.type === "image")?.data.assetId;

          return {
            outputAssetIds: ["asset_out"],
            outputAssets: [{ assetId: "asset_out", url: "/outputs/asset_out.png" }],
            data: {
              versionId: "v_0001",
              providerId: node.data.providerId,
              model: node.data.model,
              prompt,
              inputAssetIds: [baseAssetId],
              parentAssetIds: [baseAssetId]
            }
          };
        }
      }
    });

    expect(result.ok).toBe(true);

    appendVersion(s, {
      action: "img2img",
      model: "fake-image-model",
      prompt: "cinematic product shot",
      params: { providerId: "fake-provider" },
      providerId: "fake-provider",
      sourceRunId: runId,
      sourceNodeId: "img2img1",
      parentAssetIds: ["asset_base"],
      baseAssetId: "asset_base",
      outputAssetIds: ["asset_out"],
      selectedOutputAssetId: "asset_out",
      latencyMs: 42,
      status: "success"
    });

    const run = appendRunRecord(s, {
      runId,
      flowId: runId,
      canvasId,
      status: "success",
      startedAt: "2026-05-20T00:00:00.000Z",
      completedAt: "2026-05-20T00:00:01.000Z",
      latencyMs: 1000,
      snapshot: flow,
      nodes: result.nodes
    });

    await saveCanvas({ ...flow, title: "Phase One Acceptance Canvas" });
    const restoredCanvas = await loadCanvas(canvasId);
    const trace = traceAssetProvenance(s, "asset_out");
    const ragEvent: RagEvent = {
      event_id: "event_phase_one",
      timestamp: "2026-05-20T00:00:01.000Z",
      session_id: sessionId,
      action: "flow_execute",
      model: "fake",
      prompt: "execute_canvas_flow",
      params: { runId, nodeRuns: run.nodes },
      input_assets: [],
      output_assets: ["asset_out"],
      status: "success",
      latency_ms: 1000,
      flow_id: runId,
      flow_structure: {
        nodes: flow.nodes.map((node) => `${node.id}:${node.type}`),
        edges: flow.edges.map((edge) => ({ from: edge.from, to: edge.to }))
      }
    };

    expect(run.outputAssetIds).toEqual(["asset_out"]);
    expect(run.nodes.find((node) => node.nodeId === "img2img1")).toMatchObject({
      providerId: "fake-provider",
      model: "fake-image-model",
      prompt: "cinematic product shot",
      inputAssetIds: ["asset_base"],
      outputAssetIds: ["asset_out"],
      versionId: "v_0001"
    });
    expect(restoredCanvas).toMatchObject({
      canvasId,
      sessionId,
      title: "Phase One Acceptance Canvas",
      selectedNodeId: "img2img1",
      viewport: { x: -80, y: 24, zoom: 0.85 }
    });
    expect(trace.chain.map((item) => [item.assetId, item.sourceRunId, item.sourceNodeId])).toEqual([
      ["asset_out", runId, "img2img1"],
      ["asset_base", undefined, undefined]
    ]);
    expect(filterEvents([ragEvent], { runId, assetId: "asset_out" })).toHaveLength(1);
  });
});
