import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { AssetMeta } from "./assets";
import type { FlowSnapshot, NodeExecutionResult } from "../flows/types";

export type CanvasVersion = {
  versionId: string;
  parentVersionId?: string | undefined;
  sourceRunId?: string | undefined;
  sourceNodeId?: string | undefined;
  providerId?: string | undefined;
  action: "text2img" | "img2img" | "inpaint" | "video";
  model: string;
  prompt: string;
  negativePrompt?: string | undefined;
  params: Record<string, unknown>;
  parentAssetIds?: string[] | undefined;
  baseAssetId?: string | undefined;
  maskAssetId?: string | undefined;
  outputAssetIds: string[];
  selectedOutputAssetId?: string | undefined;
  createdAt: string;
  latencyMs: number;
  status: "success" | "failed";
  errorMessage?: string | undefined;
};

export type CanvasRunNode = {
  nodeId: string;
  nodeType: string;
  status: string;
  attempts: number;
  latencyMs: number;
  providerId?: string | undefined;
  model?: string | undefined;
  prompt?: string | undefined;
  versionId?: string | undefined;
  inputAssetIds: string[];
  outputAssetIds: string[];
  errorMessage?: string | undefined;
};

export type CanvasRunRecord = {
  runId: string;
  flowId: string;
  canvasId: string;
  targetNodeId?: string | undefined;
  status: "success" | "failed";
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  snapshot: FlowSnapshot;
  nodes: CanvasRunNode[];
  outputAssetIds: string[];
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
  runs?: CanvasRunRecord[] | undefined;
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
    sourceRunId: input.sourceRunId,
    sourceNodeId: input.sourceNodeId,
    providerId: input.providerId,
    action: input.action,
    model: input.model,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    params: input.params,
    parentAssetIds: input.parentAssetIds,
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

export function appendRunRecord(
  session: CanvasSession,
  input: Omit<CanvasRunRecord, "nodes" | "outputAssetIds"> & { nodes: NodeExecutionResult[] }
): CanvasRunRecord {
  const nodes = input.nodes.map((node) => {
    const data = node.data ?? {};
    return {
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      status: node.status,
      attempts: node.attempts,
      latencyMs: node.latencyMs,
      providerId: optionalString(data.providerId),
      model: optionalString(data.model),
      prompt: optionalString(data.prompt),
      versionId: optionalString(data.versionId),
      inputAssetIds: node.inputAssetIds ?? stringArray(data.inputAssetIds),
      outputAssetIds: node.outputAssetIds,
      errorMessage: node.errorMessage
    };
  });

  const record: CanvasRunRecord = {
    runId: input.runId,
    flowId: input.flowId,
    canvasId: input.canvasId,
    targetNodeId: input.targetNodeId,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    latencyMs: input.latencyMs,
    snapshot: input.snapshot,
    nodes,
    outputAssetIds: nodes.flatMap((node) => node.outputAssetIds),
    errorMessage: input.errorMessage
  };

  session.runs = [...(session.runs ?? []), record];
  return record;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
