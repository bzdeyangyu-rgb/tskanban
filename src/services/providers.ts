import axios from "axios";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

export const providerProtocolSchema = z.enum(["openai", "apimart"]);
export type ProviderProtocol = z.infer<typeof providerProtocolSchema>;
export type ModelCategory = "image" | "chat" | "video";
export type ProviderCapabilityKey = "text2img" | "img2img" | "inpaint" | "video" | "llm";
export type ProviderCapabilityStatus = "available" | "inferred" | "unavailable";
export type ProviderCapabilitySource = "model" | "protocol" | "none";
export type ProviderCapability = {
  label: string;
  status: ProviderCapabilityStatus;
  source: ProviderCapabilitySource;
  modelCount: number;
  reason: string;
};
export type ProviderCapabilities = Record<ProviderCapabilityKey, ProviderCapability>;

export const apiProviderInputSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  baseUrl: z.string().url(),
  protocol: providerProtocolSchema.default("openai"),
  enabled: z.boolean().default(true),
  primary: z.boolean().default(false),
  apiKey: z.string().optional(),
  imageModels: z.array(z.string()).default([]),
  chatModels: z.array(z.string()).default([]),
  videoModels: z.array(z.string()).default([])
});

export type ApiProviderInput = z.input<typeof apiProviderInputSchema>;
export type ApiProvider = z.output<typeof apiProviderInputSchema>;
export type PublicApiProvider = Omit<ApiProvider, "apiKey"> & {
  hasKey: boolean;
  keyPreview: string;
  capabilities: ProviderCapabilities;
};
export type ProviderReadiness =
  | { ready: false; reason: "no_provider"; message: string }
  | { ready: false; reason: "missing_key"; message: string; primaryProviderId: string }
  | { ready: true; reason: "ready"; message: string; primaryProviderId: string };

const DEFAULT_PROVIDERS_FILE = path.join(process.cwd(), "logs", "providers.json");

export function createProviderStore(filePath = DEFAULT_PROVIDERS_FILE) {
  async function loadProviders(): Promise<ApiProvider[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = z.array(apiProviderInputSchema).parse(JSON.parse(raw));
      return normalizePrimary(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async function saveProviders(input: ApiProviderInput[]): Promise<ApiProvider[]> {
    const current = await loadProviders();
    const currentById = new Map(current.map((provider) => [provider.id, provider]));
    const seen = new Set<string>();
    const providers = input.map((item) => {
      const provider = apiProviderInputSchema.parse(item);
      if (seen.has(provider.id)) {
        throw new Error(`duplicate provider id: ${provider.id}`);
      }
      seen.add(provider.id);
      const existingKey = currentById.get(provider.id)?.apiKey;
      const nextKey = provider.apiKey?.trim() ? provider.apiKey.trim() : existingKey;
      return {
        ...provider,
        apiKey: nextKey
      };
    });

    const normalized = normalizePrimary(providers);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async function getProvider(providerId?: string | undefined): Promise<ApiProvider> {
    const providers = await loadProviders();
    const provider =
      (providerId ? providers.find((item) => item.id === providerId) : undefined) ??
      providers.find((item) => item.primary && item.enabled) ??
      providers.find((item) => item.enabled);
    if (!provider) {
      throw new Error("no API provider configured");
    }
    if (!provider.apiKey?.trim()) {
      throw new Error(`${provider.name} missing API key`);
    }
    return provider;
  }

  async function describeReadiness(): Promise<ProviderReadiness> {
    const providers = await loadProviders();
    const enabled = providers.filter((provider) => provider.enabled);
    const primary = enabled.find((provider) => provider.primary) ?? enabled[0];

    if (!primary) {
      return {
        ready: false,
        reason: "no_provider",
        message: "未配置 API 平台"
      };
    }

    if (!primary.apiKey?.trim()) {
      return {
        ready: false,
        reason: "missing_key",
        message: `${primary.name} 缺少 API Key`,
        primaryProviderId: primary.id
      };
    }

    return {
      ready: true,
      reason: "ready",
      message: `${primary.name} 已可用于生成`,
      primaryProviderId: primary.id
    };
  }

  return {
    loadProviders,
    saveProviders,
    getProvider,
    describeReadiness,
    filePath
  };
}

export const providerStore = createProviderStore();

export function publicProvider(provider: ApiProvider): PublicApiProvider {
  const { apiKey, ...rest } = provider;
  return {
    ...rest,
    hasKey: Boolean(apiKey?.trim()),
    keyPreview: previewKey(apiKey),
    capabilities: normalizeProviderCapabilities(provider)
  };
}

export function previewKey(key: string | undefined): string {
  if (!key) {
    return "";
  }
  if (key.length <= 8) {
    return "***";
  }
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

export function classifyModelId(modelId: string): ModelCategory {
  const lower = modelId.toLowerCase();
  const videoKeys = ["veo", "sora", "wan", "kling", "hailuo", "video", "t2v", "i2v", "seedance"];
  if (videoKeys.some((key) => lower.includes(key))) {
    return "video";
  }

  const imageKeys = [
    "image",
    "img",
    "dall",
    "imagen",
    "flux",
    "stable",
    "sdxl",
    "midjourney",
    "z-image",
    "qwen-image",
    "klein"
  ];
  if (imageKeys.some((key) => lower.includes(key))) {
    return "image";
  }

  return "chat";
}

export function normalizeProviderCapabilities(input: {
  protocol: ProviderProtocol;
  imageModels?: string[];
  chatModels?: string[];
  videoModels?: string[];
}): ProviderCapabilities {
  const imageModels = input.imageModels ?? [];
  const chatModels = input.chatModels ?? [];
  const videoModels = input.videoModels ?? [];
  const protocolSupportsRichModes = input.protocol === "openai" || input.protocol === "apimart";

  const fromModel = (label: string, modelCount: number): ProviderCapability => ({
    label,
    status: "available",
    source: "model",
    modelCount,
    reason: `已识别 ${modelCount} 个相关模型`
  });

  const fromProtocol = (label: string): ProviderCapability => ({
    label,
    status: protocolSupportsRichModes ? "inferred" : "unavailable",
    source: protocolSupportsRichModes ? "protocol" : "none",
    modelCount: 0,
    reason: protocolSupportsRichModes ? `${protocolLabel(input.protocol)} 协议按兼容能力推断` : "当前协议未声明该能力"
  });

  return {
    text2img: imageModels.length > 0 ? fromModel("文生图", imageModels.length) : fromProtocol("文生图"),
    img2img: imageModels.length > 0 ? fromModel("图生图", imageModels.length) : fromProtocol("图生图"),
    inpaint: fromProtocol("局部重绘"),
    video: videoModels.length > 0 ? fromModel("视频", videoModels.length) : fromProtocol("视频"),
    llm: chatModels.length > 0 ? fromModel("LLM", chatModels.length) : fromProtocol("LLM")
  };
}

export async function fetchProviderModels(input: {
  baseUrl: string;
  apiKey: string;
  protocol?: ProviderProtocol;
}): Promise<{
  total: number;
  all: string[];
  imageModels: string[];
  chatModels: string[];
  videoModels: string[];
  capabilities: ProviderCapabilities;
}> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const response = await axios.get(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      Accept: "application/json"
    },
    timeout: 30000
  });
  const ids = extractModelIds(response.data);
  const grouped = {
    imageModels: [] as string[],
    chatModels: [] as string[],
    videoModels: [] as string[]
  };
  for (const id of ids) {
    const category = classifyModelId(id);
    if (category === "image") {
      grouped.imageModels.push(id);
    } else if (category === "video") {
      grouped.videoModels.push(id);
    } else {
      grouped.chatModels.push(id);
    }
  }
  return {
    total: ids.length,
    all: ids,
    ...grouped,
    capabilities: normalizeProviderCapabilities({
      protocol: input.protocol ?? "openai",
      ...grouped
    })
  };
}

export async function testProviderConnection(input: {
  baseUrl: string;
  apiKey: string;
  protocol?: ProviderProtocol;
}): Promise<{ ok: boolean; status: number; message: string } & Awaited<ReturnType<typeof fetchProviderModels>>> {
  const models = await fetchProviderModels(input);
  return {
    ok: true,
    status: 200,
    message: `found ${models.total} models`,
    ...models
  };
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") || trimmed.endsWith("/v2") ? trimmed : `${trimmed}/v1`;
}

function extractModelIds(data: unknown): string[] {
  const items =
    data && typeof data === "object"
      ? ((data as Record<string, unknown>).data ?? (data as Record<string, unknown>).models ?? [])
      : [];
  if (!Array.isArray(items)) {
    return [];
  }

  const ids = new Set<string>();
  for (const item of items) {
    if (typeof item === "string" && item.trim()) {
      ids.add(item.trim());
      continue;
    }

    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const id = record.id ?? record.name ?? record.model;
      if (typeof id === "string" && id.trim()) {
        ids.add(id.trim());
      }
    }
  }

  return [...ids].sort();
}

function normalizePrimary(providers: ApiProvider[]): ApiProvider[] {
  const enabled = providers.filter((provider) => provider.enabled);
  const primaryId = [...providers].reverse().find((provider) => provider.primary && provider.enabled)?.id ?? enabled[0]?.id;
  return providers.map((provider) => ({
    ...provider,
    primary: provider.id === primaryId
  }));
}

function protocolLabel(protocol: ProviderProtocol): string {
  return protocol === "apimart" ? "APIMart 异步" : "OpenAI 兼容";
}
