import axios from "axios";
import { z } from "zod";

const envSchema = z.object({
  IMAGE_API_BASE_URL: z.string().url(),
  IMAGE_API_KEY: z.string().optional(),
  IMAGE_API_TEXT2IMG_PATH: z.string().default("/text2img"),
  IMAGE_API_INPAINT_PATH: z.string().default("/inpaint"),
  IMAGE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(120000)
});

export type ImageAction = "text2img" | "inpaint";

export type ImageParams = {
  size?: string | undefined;
  steps?: number | undefined;
  strength?: number | undefined;
  seed?: number | undefined;
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

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function extractOutputAssets(data: unknown): string[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const candidate = data as Record<string, unknown>;
  const directFields = ["output", "outputs", "image", "images", "url", "urls", "result"];

  for (const key of directFields) {
    const value = candidate[key];
    const urls = normalizeToStringArray(value);
    if (urls.length > 0) {
      return urls;
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
      const url = record.url;
      const imageUrl = record.image_url;
      if (typeof url === "string") {
        out.push(url);
      } else if (typeof imageUrl === "string") {
        out.push(imageUrl);
      }
    }
  }

  return out;
}

export async function generateImage(request: ImageRequest): Promise<ImageResult> {
  const env = loadEnv();
  const path = request.action === "text2img" ? env.IMAGE_API_TEXT2IMG_PATH : env.IMAGE_API_INPAINT_PATH;
  const url = `${env.IMAGE_API_BASE_URL}${normalizePath(path)}`;

  const payload = {
    model: request.model,
    prompt: request.prompt,
    negative_prompt: request.negativePrompt,
    ...request.params,
    input_image: request.inputImage,
    mask_image: request.maskImage
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

  const outputAssets = extractOutputAssets(response.data);
  return {
    outputAssets,
    raw: response.data
  };
}
