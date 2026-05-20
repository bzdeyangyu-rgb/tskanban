import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCanvas, loadCanvas, saveCanvas } from "./canvases";

const canvasDir = path.join(process.cwd(), "logs", "canvases");

describe("canvas storage", () => {
  beforeEach(async () => {
    await mkdir(canvasDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(path.join(canvasDir, "c_test_canvas.json"), { force: true });
  });

  it("creates a new empty canvas snapshot", async () => {
    const canvas = await createCanvas({ canvasId: "c_test_canvas", sessionId: "s1", title: "测试画布" });

    expect(canvas.canvasId).toBe("c_test_canvas");
    expect(canvas.sessionId).toBe("s1");
    expect(canvas.title).toBe("测试画布");
    expect(canvas.nodes).toEqual([]);
    expect(canvas.edges).toEqual([]);
    expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvas.createdAt).toBeTruthy();
    expect(canvas.updatedAt).toBeTruthy();
  });

  it("uses a readable default title for new canvases", async () => {
    const canvas = await createCanvas({ canvasId: "c_test_canvas" });

    expect(canvas.title).toBe("未命名画布");
  });

  it("saves and loads a full canvas worksite", async () => {
    const saved = await saveCanvas({
      canvasId: "c_test_canvas",
      sessionId: "s1",
      title: "流程 1",
      nodes: [
        {
          id: "p1",
          type: "prompt",
          x: 10,
          y: 20,
          width: 240,
          height: 120,
          data: { text: "clean product photo" }
        },
        {
          id: "g1",
          type: "api_text2img",
          x: 300,
          y: 20,
          width: 260,
          height: 150,
          data: { model: "test-model" },
          status: "idle"
        }
      ],
      edges: [{ id: "e1", from: "p1", to: "g1", fromHandle: "out", toHandle: "prompt" }],
      viewport: { x: -120, y: 45, zoom: 0.75 },
      selectedNodeId: "g1",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z"
    });

    const loaded = await loadCanvas("c_test_canvas");

    expect(saved.updatedAt).not.toBe("2026-05-19T00:00:00.000Z");
    expect(loaded.canvasId).toBe("c_test_canvas");
    expect(loaded.nodes).toHaveLength(2);
    expect(loaded.nodes[0]?.data).toEqual({ text: "clean product photo" });
    expect(loaded.edges[0]).toEqual({ id: "e1", from: "p1", to: "g1", fromHandle: "out", toHandle: "prompt" });
    expect(loaded.viewport).toEqual({ x: -120, y: 45, zoom: 0.75 });
    expect(loaded.selectedNodeId).toBe("g1");
  });
});
