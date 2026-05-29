import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCanvas, deleteCanvas, listCanvases, loadCanvas, restoreCanvas, saveCanvas } from "../src/services/canvases";

const canvasDir = path.join(process.cwd(), "logs", "canvases");

describe("画布保存、删除与恢复", () => {
  beforeEach(async () => {
    await mkdir(canvasDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(path.join(canvasDir, "c_history_canvas.json"), { force: true });
  });

  it("删除画布只写入 deletedAt，仍可加载并恢复", async () => {
    await createCanvas({ canvasId: "c_history_canvas", title: "历史画布" });

    const deleted = await deleteCanvas("c_history_canvas");
    expect(deleted.deletedAt).toBeTruthy();
    expect((await listCanvases()).some((canvas) => canvas.canvasId === "c_history_canvas")).toBe(false);

    const loaded = await loadCanvas("c_history_canvas");
    expect(loaded.deletedAt).toBe(deleted.deletedAt);
    expect((await listCanvases({ includeDeleted: true })).some((canvas) => canvas.canvasId === "c_history_canvas")).toBe(true);

    const restored = await restoreCanvas("c_history_canvas");
    expect(restored.deletedAt).toBeUndefined();
    expect((await listCanvases()).some((canvas) => canvas.canvasId === "c_history_canvas")).toBe(true);
  });

  it("保存已删除画布时保留 deletedAt，避免误恢复", async () => {
    await saveCanvas({
      canvasId: "c_history_canvas",
      title: "不可误恢复",
      deletedAt: "2026-05-29T00:00:00.000Z",
      nodes: [{ id: "p1", type: "prompt", x: 0, y: 0, width: 100, height: 80, data: { text: "保存测试" } }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    });

    const saved = await loadCanvas("c_history_canvas");
    expect(saved.deletedAt).toBe("2026-05-29T00:00:00.000Z");
  });
});
