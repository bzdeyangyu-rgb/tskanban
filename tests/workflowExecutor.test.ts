import { describe, expect, it } from "vitest";
import { executeFlowSnapshot } from "../src/flows/execute";
import type { FlowSnapshot } from "../src/flows/types";
import { classifyRetryableError, createNodeRunRecord } from "../src/logger";

function flow(): FlowSnapshot {
  return {
    canvasId: "c_rag",
    sessionId: "s_rag",
    nodes: [
      { id: "p1", type: "prompt", x: 10, y: 20, width: 240, height: 120, data: { text: "保留空间结构" } },
      {
        id: "g1",
        type: "api_inpaint",
        x: 300,
        y: 40,
        width: 280,
        height: 160,
        data: {
          model: "image-model",
          prompt: "替换局部墙面",
          selection: { x: 12, y: 24, width: 128, height: 96, canvasWidth: 1024, canvasHeight: 768 },
          localPrompt: "只改左侧墙面"
        }
      },
      { id: "o1", type: "output", x: 640, y: 40, width: 260, height: 160, data: {} }
    ],
    edges: [
      { id: "e1", from: "p1", to: "g1" },
      { id: "e2", from: "g1", to: "o1" }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

describe("运行日志和重试分类", () => {
  it("API 网络、5xx、限流错误可以重试", () => {
    expect(classifyRetryableError({ code: "ECONNRESET", message: "socket hang up" })).toBe(true);
    expect(classifyRetryableError({ status: 502, message: "bad gateway" })).toBe(true);
    expect(classifyRetryableError({ status: 429, message: "rate limit" })).toBe(true);
  });

  it("缺输入、参数错误、鉴权错误不自动重试", () => {
    expect(classifyRetryableError({ status: 400, message: "missing input image" })).toBe(false);
    expect(classifyRetryableError({ status: 401, message: "unauthorized" })).toBe(false);
    expect(classifyRetryableError({ status: 403, message: "forbidden" })).toBe(false);
  });

  it("不可重试错误只执行一次并返回失败节点", async () => {
    let attempts = 0;
    const result = await executeFlowSnapshot(flow(), {
      sessionId: "s_rag",
      maxRetries: 3,
      runners: {
        api_inpaint: async () => {
          attempts += 1;
          const error = new Error("missing input image") as Error & { status?: number };
          error.status = 400;
          throw error;
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(attempts).toBe(1);
    expect(result.nodes.find((node) => node.nodeId === "g1")?.attempts).toBe(1);
  });

  it("记录流程结构、节点输入输出耗时、局部坐标和局部提示词", () => {
    const record = createNodeRunRecord({
      flowId: "flow-1",
      canvasId: "c_rag",
      runId: "run-1",
      nodeId: "g1",
      nodeType: "api_inpaint",
      status: "success",
      attempts: 2,
      maxRetries: 3,
      latencyMs: 1200,
      inputAssetIds: ["input-1"],
      outputAssetIds: ["output-1"],
      nodeInputs: { prompt: "替换局部墙面", upstreamNodes: [{ nodeId: "p1", nodeType: "prompt" }] },
      flowStructure: { nodes: ["p1:prompt", "g1:api_inpaint"], edges: [{ from: "p1", to: "g1" }] },
      selectionBox: { x: 12, y: 24, width: 128, height: 96, canvasWidth: 1024, canvasHeight: 768 },
      localPrompt: "只改左侧墙面"
    });

    expect(record.input_assets).toEqual(["input-1"]);
    expect(record.output_assets).toEqual(["output-1"]);
    expect(record.node_latency_ms).toBe(1200);
    expect(record.flow_structure?.nodes).toEqual(["p1:prompt", "g1:api_inpaint"]);
    expect(record.selection_box?.x).toBe(12);
    expect(record.local_prompt).toBe("只改左侧墙面");
  });
});
