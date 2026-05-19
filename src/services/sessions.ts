import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { AssetMeta } from "./assets";

export type CanvasVersion = {
  versionId: string;
  parentVersionId?: string | undefined;
  action: "text2img" | "img2img" | "inpaint";
  model: string;
  prompt: string;
  negativePrompt?: string | undefined;
  params: Record<string, unknown>;
  baseAssetId?: string | undefined;
  maskAssetId?: string | undefined;
  outputAssetIds: string[];
  selectedOutputAssetId?: string | undefined;
  createdAt: string;
  latencyMs: number;
  status: "success" | "failed";
  errorMessage?: string | undefined;
};

export type CanvasSession = {
  sessionId: string;
  title?: string | undefined;
  createdAt: string;
  updatedAt: string;
  currentVersionId?: string | undefined;
  versions: CanvasVersion[];
  assets: AssetMeta[];
};

const ROOT = process.cwd();
const SESSION_DIR = path.join(ROOT, "logs", "sessions");

function sessionFilePath(sessionId: string) {
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

export function newSessionId(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `s_${y}${m}${day}_${randomUUID().slice(0, 4)}`;
}

function nextVersionId(session: CanvasSession): string {
  const next = session.versions.length + 1;
  return `v_${String(next).padStart(4, "0")}`;
}

export async function createSession(input: { title?: string | undefined }): Promise<CanvasSession> {
  await mkdir(SESSION_DIR, { recursive: true });
  const now = new Date().toISOString();
  const session: CanvasSession = {
    sessionId: newSessionId(),
    title: input.title,
    createdAt: now,
    updatedAt: now,
    versions: [],
    assets: []
  };

  await writeFile(sessionFilePath(session.sessionId), `${JSON.stringify(session, null, 2)}\n`, "utf8");
  return session;
}

export async function loadSession(sessionId: string): Promise<CanvasSession> {
  const raw = await readFile(sessionFilePath(sessionId), "utf8");
  return JSON.parse(raw) as CanvasSession;
}

export async function saveSession(session: CanvasSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await mkdir(SESSION_DIR, { recursive: true });
  await writeFile(sessionFilePath(session.sessionId), `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export async function getOrCreateSession(sessionId?: string | undefined): Promise<CanvasSession> {
  if (sessionId) {
    return loadSession(sessionId);
  }

  return createSession({});
}

export function attachAsset(session: CanvasSession, asset: AssetMeta): void {
  session.assets.push(asset);
}

export function appendVersion(
  session: CanvasSession,
  input: Omit<CanvasVersion, "versionId" | "createdAt"> & { parentVersionId?: string | undefined }
): CanvasVersion {
  const version: CanvasVersion = {
    versionId: nextVersionId(session),
    createdAt: new Date().toISOString(),
    parentVersionId: input.parentVersionId,
    action: input.action,
    model: input.model,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    params: input.params,
    baseAssetId: input.baseAssetId,
    maskAssetId: input.maskAssetId,
    outputAssetIds: input.outputAssetIds,
    selectedOutputAssetId: input.selectedOutputAssetId,
    latencyMs: input.latencyMs,
    status: input.status,
    errorMessage: input.errorMessage
  };

  session.versions.push(version);
  session.currentVersionId = version.versionId;
  return version;
}
