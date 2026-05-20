import { describe, expect, it } from "vitest";
import { filterEvents, type RagEvent } from "./logger";

function event(input: Partial<RagEvent>): RagEvent {
  return {
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
});
