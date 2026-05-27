import axios from "axios";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeBaseUrl, type ApiProvider } from "./services/providers";

const envSchema = z.object({
  IMAGE_API_BASE_URL: z.string().url(),
  IMAGE_API_KEY: z.string().optional(),
  IMAGE_API_TEXT2IMG_PATH: z.string().default("/text2img"),
  IMAGE_API_IMG2IMG_PATH: z.string().default("/img2img"),
  IMAGE_API_INPAINT_PATH: z.string().default("/inpaint"),
  IMAGE_API_VIDEO_PATH: z.string().default("/videos/generations"),
  IMAGE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(120000)
});

export type ImageAction = "text2img" | "img2img" | "inpaint" | "video";

export type ImageParams = {
  size?: string | undefined;
  steps?: number | undefined;
  strength?: number | undefined;
  seed?: number | undefined;
  [key: string]: unknown;
};

export type ImageRequest = {
  action: ImageAction;
  model: string;
  prompt: string;
  negativePrompt?: string | undefined;
  params?: ImageParams | undefined;
  inputImage?: string | undefined;
  maskImage?: string | undefined;
  provider?: ApiProvider | undefined;
};

export type ImageResult = {
  outputAssets: string[];
  raw: unknown;
};

function loadEnv() {
  return envSchema.parse(process.env);
}

function normalizePath(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function extensionToMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "application/octet-stream";
}

async function normalizeImageInput(input: string | undefined): Promise<string | undefined> {
  if (!input) {
    return undefined;
  }

  if (input.startsWith("data:") || input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  try {
    const buffer = await readFile(input);
    const mime = extensionToMime(input);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return input;
  }
}

export function extractOutputAssets(data: unknown): string[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const candidate = data as Record<string, unknown>;
  const directFields = ["output", "outputs", "image", "images", "url", "urls", "result"];

  for (const key of directFields) {
    const urls = normalizeToStringArray(candidate[key]);
    if (urls.length > 0) {
      return urls;
    }
  }

  const dataField = candidate.data;
  const fromData = normalizeToStringArray(dataField);
  if (fromData.length > 0) {
    return fromData;
  }

  if (dataField && typeof dataField === "object") {
    const nested = dataField as Record<string, unknown>;
    for (const key of directFields) {
      const urls = normalizeToStringArray(nested[key]);
      if (urls.length > 0) {
        return urls;
      }
    }
  }

  return [];
}

export function buildImageApiCall(input: {
  request: ImageRequest;
  baseUrl: string;
  apiKey?: string | undefined;
  protocol?: "openai" | "apimart" | undefined;
}): { url: string; payload: Record<string, unknown>; headers: Record<string, string> } {
  const protocol = input.protocol ?? "openai";
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const action = input.request.action;
  const endpoint = openAiCompatibleEndpoint(action);
  const payload =
    protocol === "openai" || protocol === "apimart"
      ? buildOpenAiCompatiblePayload(input.request)
      : buildOpenAiCompatiblePayload(input.request);

  return {
    url: `${baseUrl}${endpoint}`,
    payload,
    headers: buildHeaders(input.apiKey)
  };
}

function openAiCompatibleEndpoint(action: ImageAction): string {
  if (action === "video") {
    return "/videos/generations";
  }
  if (action === "img2img" || action === "inpaint") {
    return "/images/edits";
  }
  return "/images/generations";
}

function normalizeToStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      out.push(item);
      continue;
    }

    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const candidates = [record.url, record.image_url, record.output, record.result];
      for (const candidate of candidates) {
        if (typeof candidate === "string") {
          out.push(candidate);
          break;
        }
      }

      if (typeof record.b64_json === "string") {
        out.push(`data:image/png;base64,${record.b64_json}`);
      }
    }
  }

  return out;
}

export async function generateImage(request: ImageRequest): Promise<ImageResult> {
  const inputImage = await normalizeImageInput(request.inputImage);
  const maskImage = await normalizeImageInput(request.maskImage);
  const normalizedRequest = { ...request, inputImage, maskImage };
  const env = request.provider ? undefined : loadEnv();
  const call = request.provider
    ? buildImageApiCall({
        request: normalizedRequest,
        baseUrl: request.provider.baseUrl,
        apiKey: request.provider.apiKey,
        protocol: request.provider.protocol
      })
    : buildEnvImageApiCall(normalizedRequest, env ?? loadEnv());

  const response = await axios.post(call.url, call.payload, {
    headers: call.headers,
    timeout: env?.IMAGE_API_TIMEOUT_MS ?? 120000
  });

  const data = request.provider?.protocol === "apimart" ? await resolveApimartResult(response.data, request.provider) : response.data;

  return {
    outputAssets: extractOutputAssets(data),
    raw: data
  };
}

function buildEnvImageApiCall(request: ImageRequest, env: z.output<typeof envSchema>) {
  const endpoint =
    request.action === "text2img"
      ? env.IMAGE_API_TEXT2IMG_PATH
      : request.action === "img2img"
        ? env.IMAGE_API_IMG2IMG_PATH
        : request.action === "video"
          ? env.IMAGE_API_VIDEO_PATH
          : env.IMAGE_API_INPAINT_PATH;
  const url = `${env.IMAGE_API_BASE_URL}${normalizePath(endpoint)}`;
  const payload = {
    model: request.model,
    prompt: request.prompt,
    negative_prompt: request.negativePrompt,
    ...request.params,
    input_image: request.inputImage,
    mask_image: request.maskImage
  };
  return {
    url,
    payload,
    headers: buildHeaders(env.IMAGE_API_KEY)
  };
}

function buildOpenAiCompatiblePayload(request: ImageRequest): Record<string, unknown> {
  const { count, ...params } = request.params ?? {};
  const payload: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    negative_prompt: request.negativePrompt,
    ...params
  };

  const numericCount = typeof count === "number" ? count : typeof count === "string" && count.trim() ? Number(count) : NaN;
  if (Number.isFinite(numericCount)) {
    payload.n = numericCount;
  }

  if (request.inputImage) {
    payload.images = [{ image_url: request.inputImage }];
  }

  if (request.maskImage) {
    payload.mask = { image_url: request.maskImage };
  }

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""));
}

function buildHeaders(apiKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function resolveApimartResult(data: unknown, provider: ApiProvider): Promise<unknown> {
  const immediate = extractOutputAssets(data);
  if (immediate.length > 0) {
    return data;
  }

  const taskId = extractTaskId(data);
  if (!taskId) {
    return data;
  }

  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const headers = buildHeaders(provider.apiKey);
  let latest: unknown = data;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await axios.get(`${baseUrl}/tasks/${taskId}`, { headers, timeout: 30000 });
    latest = response.data;
    const status = extractStatus(response.data);
    if (["succeeded", "success", "completed", "done"].includes(status)) {
      return response.data;
    }
    if (["failed", "error", "canceled", "cancelled", "timeout"].includes(status)) {
      throw new Error(`APIMart task failed: ${JSON.stringify(response.data).slice(0, 300)}`);
    }
  }
  throw new Error(`APIMart task timed out: ${JSON.stringify(latest).slice(0, 300)}`);
}

function extractTaskId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : {};
  const candidates = [record.task_id, record.taskId, record.id, nested.task_id, nested.taskId, nested.id];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
}

function extractStatus(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  const record = data as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : {};
  const value = record.status ?? record.state ?? nested.status ?? nested.state;
  return typeof value === "string" ? value.toLowerCase() : "";
}
