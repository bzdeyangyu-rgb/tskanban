import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type EventAction =
  | "text2img"
  | "img2img"
  | "inpaint"
  | "video"
  | "prompt_template_use"
  | "prompt_template_create"
  | "asset_upload"
  | "flow_validate"
  | "flow_execute";

export type RagEvent = {
  event_id: string;
  timestamp: string;
  session_id: string;
  action: EventAction;
  model: string;
  prompt: string;
  negative_prompt?: string | undefined;
  params: Record<string, unknown>;
  input_assets: string[];
  output_assets: string[];
  status: "success" | "failed";
  latency_ms: number;
  error_message?: string | undefined;
  flow_id?: string | undefined;
  flow_structure?: { nodes: string[]; edges: { from: string; to: string }[] } | undefined;
  node_id?: string | undefined;
  node_type?: string | undefined;
  node_status?: "idle" | "running" | "success" | "failed" | "retrying" | undefined;
  retry_attempt?: number | undefined;
  max_retries?: number | undefined;
  node_latency_ms?: number | undefined;
  selection_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
    canvasWidth: number;
    canvasHeight: number;
  } | undefined;
  local_prompt?: string | undefined;
};

export type EventQuery = {
  sessionId?: string | undefined;
  action?: string | undefined;
  model?: string | undefined;
  runId?: string | undefined;
  assetId?: string | undefined;
  keyword?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
};

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "logs");
const JSONL_PATH = path.join(LOG_DIR, "rag_events.jsonl");
const MARKDOWN_PATH = path.join(LOG_DIR, "RAG_LOG.md");

export function createSessionId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const suffix = randomUUID().slice(0, 4);
  return `s_${y}${m}${day}_${suffix}`;
}

export function createFlowId() {
  return `f_${randomUUID().slice(0, 8)}`;
}

export function createBaseEvent(input: {
  sessionId: string;
  action: EventAction;
  model: string;
  prompt: string;
  negativePrompt?: string | undefined;
  params?: Record<string, unknown> | undefined;
  inputAssets?: string[] | undefined;
}) {
  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: input.sessionId,
    action: input.action,
    model: input.model,
    prompt: input.prompt,
    negative_prompt: input.negativePrompt,
    params: input.params ?? {},
    input_assets: input.inputAssets ?? []
  };
}

export async function logEvent(event: RagEvent): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });

  const jsonlLine = `${JSON.stringify(event)}\n`;
  await appendFile(JSONL_PATH, jsonlLine, "utf8");

  const mdBlock = toMarkdownBlock(event);
  await appendFile(MARKDOWN_PATH, mdBlock, "utf8");
}

function toMarkdownBlock(event: RagEvent): string {
  const date = event.timestamp.replace("T", " ").replace(".000Z", "Z");
  const params = Object.keys(event.params).length > 0 ? JSON.stringify(event.params) : "{}";
  const input = event.input_assets.length > 0 ? event.input_assets.join(" + ") : "-";
  const output = event.output_assets.length > 0 ? event.output_assets.join(", ") : "-";
  const error = event.error_message ? `\n- error: ${event.error_message}` : "";
  const flowInfo = event.flow_id ? `\n- flow: ${event.flow_id}` : "";
  const nodeInfo = event.node_id
    ? `\n- node: ${event.node_id} (${event.node_type ?? "unknown"}) ${event.node_status ?? ""}`
    : "";
  const retryInfo =
    typeof event.retry_attempt === "number"
      ? `\n- retry: ${event.retry_attempt}/${event.max_retries ?? 3}`
      : "";
  const selectionInfo = event.selection_box
    ? `\n- selection: ${JSON.stringify(event.selection_box)}\n- local_prompt: "${event.local_prompt ?? ""}"`
    : "";

  return `\n## ${date} ${event.action} ${event.status}\n- session: ${event.session_id}\n- model: ${event.model}\n- prompt: "${event.prompt}"\n- negative_prompt: "${event.negative_prompt ?? ""}"\n- params: ${params}\n- input: ${input}\n- output: ${output}\n- latency: ${event.latency_ms}ms${flowInfo}${nodeInfo}${retryInfo}${selectionInfo}${error}\n`;
}

export async function readLatestEvents(limit: number): Promise<RagEvent[]> {
  const raw = await readFile(JSONL_PATH, "utf8").catch(() => "");
  if (!raw.trim()) {
    return [];
  }

  const lines = raw.trim().split("\n");
  const selected = lines.slice(-limit);
  const events: RagEvent[] = [];

  for (const line of selected) {
    try {
      events.push(JSON.parse(line) as RagEvent);
    } catch {
      continue;
    }
  }

  return events;
}

export async function queryEvents(query: EventQuery): Promise<RagEvent[]> {
  const raw = await readFile(JSONL_PATH, "utf8").catch(() => "");
  if (!raw.trim()) {
    return [];
  }

  const fromMs = query.from ? Date.parse(query.from) : Number.NEGATIVE_INFINITY;
  const toMs = query.to ? Date.parse(query.to) : Number.POSITIVE_INFINITY;
  const keyword = query.keyword?.toLowerCase();

  const all = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as RagEvent;
      } catch {
        return null;
      }
    })
    .filter((event): event is RagEvent => event !== null);

  const filtered = filterEvents(all, query);
  const limit = query.limit ?? 50;
  return filtered.slice(-limit);
}

export function filterEvents(events: RagEvent[], query: EventQuery): RagEvent[] {
  const fromMs = query.from ? Date.parse(query.from) : Number.NEGATIVE_INFINITY;
  const toMs = query.to ? Date.parse(query.to) : Number.POSITIVE_INFINITY;
  const keyword = query.keyword?.toLowerCase();

  return events.filter((event) => {
    if (query.sessionId && event.session_id !== query.sessionId) {
      return false;
    }

    if (query.action && event.action !== query.action) {
      return false;
    }

    if (query.model && event.model !== query.model) {
      return false;
    }

    if (query.runId && !eventMatchesRun(event, query.runId)) {
      return false;
    }

    if (query.assetId && !eventMatchesAsset(event, query.assetId)) {
      return false;
    }

    const ts = Date.parse(event.timestamp);
    if (ts < fromMs || ts > toMs) {
      return false;
    }

    if (keyword) {
      const text = `${event.prompt} ${event.negative_prompt ?? ""} ${JSON.stringify(event.params)} ${event.error_message ?? ""}`.toLowerCase();
      if (!text.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}

function eventMatchesRun(event: RagEvent, runId: string): boolean {
  return event.flow_id === runId || event.params.runId === runId || event.params.sourceRunId === runId;
}

function eventMatchesAsset(event: RagEvent, assetId: string): boolean {
  if (event.input_assets.includes(assetId) || event.output_assets.includes(assetId)) {
    return true;
  }

  const nodeRuns = event.params.nodeRuns;
  if (!Array.isArray(nodeRuns)) {
    return false;
  }

  return nodeRuns.some((nodeRun) => {
    if (!nodeRun || typeof nodeRun !== "object") {
      return false;
    }
    const inputAssetIds = "inputAssetIds" in nodeRun ? nodeRun.inputAssetIds : undefined;
    const outputAssetIds = "outputAssetIds" in nodeRun ? nodeRun.outputAssetIds : undefined;
    return arrayIncludesString(inputAssetIds, assetId) || arrayIncludesString(outputAssetIds, assetId);
  });
}

function arrayIncludesString(value: unknown, expected: string): boolean {
  return Array.isArray(value) && value.some((item) => item === expected);
}
