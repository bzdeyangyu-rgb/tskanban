import axios from "axios";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";

const envSchema = z.object({
  IMAGE_API_BASE_URL: z.string().url(),
  IMAGE_API_KEY: z.string().optional(),
  IMAGE_API_TEXT2IMG_PATH: z.string().default("/text2img"),
  IMAGE_API_IMG2IMG_PATH: z.string().default("/img2img"),
  IMAGE_API_INPAINT_PATH: z.string().default("/inpaint"),
  IMAGE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(120000)
});

export type ImageAction = "text2img" | "img2img" | "inpaint";

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

function extractOutputAssets(data: unknown): string[] {
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
    }
  }

  return out;
}

export async function generateImage(request: ImageRequest): Promise<ImageResult> {
  const env = loadEnv();
  const endpoint =
    request.action === "text2img"
      ? env.IMAGE_API_TEXT2IMG_PATH
      : request.action === "img2img"
        ? env.IMAGE_API_IMG2IMG_PATH
        : env.IMAGE_API_INPAINT_PATH;
  const url = `${env.IMAGE_API_BASE_URL}${normalizePath(endpoint)}`;

  const inputImage = await normalizeImageInput(request.inputImage);
  const maskImage = await normalizeImageInput(request.maskImage);

  const payload = {
    model: request.model,
    prompt: request.prompt,
    negative_prompt: request.negativePrompt,
    ...request.params,
    input_image: inputImage,
    mask_image: maskImage
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (env.IMAGE_API_KEY) {
    headers.Authorization = `Bearer ${env.IMAGE_API_KEY}`;
  }

  const response = await axios.post(url, payload, {
    headers,
    timeout: env.IMAGE_API_TIMEOUT_MS
  });

  return {
    outputAssets: extractOutputAssets(response.data),
    raw: response.data
  };
}
