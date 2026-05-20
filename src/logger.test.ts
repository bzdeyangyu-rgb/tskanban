import { describe, expect, it } from "vitest";
import { filterEvents, toMarkdownBlock, type RagEvent } from "./logger";

function event(input: Partial<RagEvent>): RagEvent {
  return {
    ...input,
    event_id: input.event_id ?? "e1",
    timestamp: input.timestamp ?? "2026-05-20T00:00:00.000Z",
    session_id: input.session_id ?? "s1",
    action: input.action ?? "flow_execute",
    model: input.model ?? "local",
    prompt: input.prompt ?? "execute_canvas_flow",
    params: input.params ?? {},
    input_assets: input.input_assets ?? [],
    output_assets: input.output_assets ?? [],
    status: input.status ?? "success",
    latency_ms: input.latency_ms ?? 1
  };
}

describe("RAG event filtering", () => {
  it("filters events by runId stored in params", () => {
    const events = [
      event({ event_id: "match", params: { runId: "run_1" } }),
      event({ event_id: "miss", params: { runId: "run_2" } })
    ];

    expect(filterEvents(events, { runId: "run_1" }).map((item) => item.event_id)).toEqual(["match"]);
  });

  it("filters events by asset id in inputs, outputs, or node runs", () => {
    const events = [
      event({ event_id: "input", input_assets: ["ast_in"] }),
      event({ event_id: "output", output_assets: ["ast_out"] }),
      event({
        event_id: "node",
        params: {
          nodeRuns: [{ inputAssetIds: ["ast_parent"], outputAssetIds: ["ast_child"] }]
        }
      }),
      event({ event_id: "miss", output_assets: ["other"] })
    ];

    expect(filterEvents(events, { assetId: "ast_parent" }).map((item) => item.event_id)).toEqual(["node"]);
    expect(filterEvents(events, { assetId: "ast_out" }).map((item) => item.event_id)).toEqual(["output"]);
  });

  it("keeps canvas and node trace fields for RAG reconstruction", () => {
    const ragEvent: RagEvent = event({
      event_id: "trace",
      prompt: "restore style",
      input_assets: ["asset_base"],
      output_assets: ["asset_out"],
      latency_ms: 120,
      canvas_id: "c1",
      canvas_snapshot_path: "logs/canvases/c1.json",
      target_node_id: "node_api",
      run_id: "run1",
      node_id: "node_api",
      node_type: "api_img2img",
      node_status: "success",
      node_inputs: { prompt: "restore style", inputAssetIds: ["asset_base"] },
      node_latency_ms: 120
    });

    expect(filterEvents([ragEvent], { runId: "run1" })).toEqual([ragEvent]);
    expect(filterEvents([ragEvent], { assetId: "asset_out" })).toEqual([ragEvent]);
    expect(filterEvents([ragEvent], { keyword: "restore" })).toEqual([ragEvent]);
  });

  it("searches keywords across canvas, run, node, status, and node input trace fields", () => {
    const ragEvent = event({
      event_id: "trace",
      prompt: "execute_canvas_flow",
      canvas_id: "canvas_keyword",
      canvas_snapshot_path: "logs/canvases/snapshot_keyword.json",
      target_node_id: "target_keyword",
      run_id: "run_keyword",
      node_id: "node_keyword",
      node_type: "api_keyword",
      node_status: "failed",
      node_inputs: {
        upstreamNodeIds: ["prompt_keyword"],
        node: { data: { prompt: "node_input_keyword" } }
      }
    });

    for (const keyword of [
      "canvas_keyword",
      "snapshot_keyword",
      "target_keyword",
      "run_keyword",
      "node_keyword",
      "api_keyword",
      "failed",
      "node_input_keyword"
    ]) {
      expect(filterEvents([ragEvent], { keyword }).map((item) => item.event_id)).toEqual(["trace"]);
    }
  });

  it("prints canvas, run, and node input trace fields in markdown", () => {
    const markdown = toMarkdownBlock(
      event({
        canvas_id: "c1",
        canvas_snapshot_path: "logs/canvases/c1.json",
        run_id: "run1",
        node_inputs: { upstreamNodeIds: ["prompt1"] }
      })
    );

    expect(markdown).toContain("- canvas: c1");
    expect(markdown).toContain("- canvas_snapshot: logs/canvases/c1.json");
    expect(markdown).toContain("- run: run1");
    expect(markdown).toContain('- node_inputs: {"upstreamNodeIds":["prompt1"]}');
  });
});
