import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { FlowSnapshot } from "../flows/types";

const ROOT = process.cwd();
const CANVAS_DIR = path.join(ROOT, "logs", "canvases");

export type StoredCanvas = FlowSnapshot & {
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SaveCanvasInput = FlowSnapshot & {
  title: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

export type CreateCanvasInput = {
  canvasId?: string | undefined;
  sessionId?: string | undefined;
  title?: string | undefined;
};

export function newCanvasId(): string {
  return `c_${randomUUID().slice(0, 10)}`;
}

export async function createCanvas(input: CreateCanvasInput = {}): Promise<StoredCanvas> {
  const now = new Date().toISOString();
  const canvas: StoredCanvas = {
    canvasId: input.canvasId ?? newCanvasId(),
    sessionId: input.sessionId,
    title: input.title ?? "未命名画布",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now
  };

  return saveCanvas(canvas);
}

export async function saveCanvas(canvas: SaveCanvasInput): Promise<StoredCanvas> {
  await mkdir(CANVAS_DIR, { recursive: true });
  const now = new Date().toISOString();
  const next: StoredCanvas = {
    ...canvas,
    createdAt: canvas.createdAt ?? now,
    updatedAt: now
  };

  await writeFile(canvasPath(next.canvasId), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function loadCanvas(canvasId: string): Promise<StoredCanvas> {
  const raw = await readFile(canvasPath(canvasId), "utf8");
  return JSON.parse(raw) as StoredCanvas;
}

export async function listCanvases(): Promise<StoredCanvas[]> {
  try {
    const entries = await readdir(CANVAS_DIR, { withFileTypes: true });
    const canvases = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const raw = await readFile(path.join(CANVAS_DIR, entry.name), "utf8");
          return JSON.parse(raw) as StoredCanvas;
        })
    );
    return canvases.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function canvasPath(canvasId: string): string {
  const safe = canvasId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CANVAS_DIR, `${safe}.json`);
}
