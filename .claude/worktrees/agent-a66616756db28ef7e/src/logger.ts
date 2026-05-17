import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type EventAction =
  | "text2img"
  | "img2img"
  | "inpaint"
  | "prompt_template_use"
  | "prompt_template_create";

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

  return `\n## ${date} ${event.action} ${event.status}\n- session: ${event.session_id}\n- model: ${event.model}\n- prompt: "${event.prompt}"\n- negative_prompt: "${event.negative_prompt ?? ""}"\n- params: ${params}\n- input: ${input}\n- output: ${output}\n- latency: ${event.latency_ms}ms${error}\n`;
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
