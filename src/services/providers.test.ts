import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyModelId,
  createProviderStore,
  normalizeProviderCapabilities,
  publicProvider,
  type ApiProviderInput
} from "./providers";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("provider store", () => {
  it("saves providers with keys and only exposes key previews publicly", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "providers-"));
    const store = createProviderStore(path.join(tempDir, "providers.json"));
    const providers: ApiProviderInput[] = [
      {
        id: "miku",
        name: "Miku API",
        baseUrl: "https://mikuapi.org/v1",
        protocol: "openai",
        enabled: true,
        primary: true,
        apiKey: "sk-1234567890abcdef",
        imageModels: ["gpt-image-2"],
        chatModels: ["gpt-5.2"],
        videoModels: ["sora-test"]
      }
    ];

    await store.saveProviders(providers);
    const loaded = await store.loadProviders();

    const provider = loaded[0];
    expect(provider?.apiKey).toBe("sk-1234567890abcdef");
    expect(provider).toBeDefined();
    const exposed = publicProvider(provider!);
    expect("apiKey" in exposed).toBe(false);
    expect(exposed.hasKey).toBe(true);
    expect(exposed.keyPreview).toBe("sk-...cdef");
  });

  it("merges saved keys when updating provider metadata without a new key", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "providers-"));
    const store = createProviderStore(path.join(tempDir, "providers.json"));
    await store.saveProviders([
      {
        id: "miku",
        name: "Miku API",
        baseUrl: "https://mikuapi.org/v1",
        protocol: "openai",
        apiKey: "sk-old",
        imageModels: []
      }
    ]);

    await store.saveProviders([
      {
        id: "miku",
        name: "Miku API renamed",
        baseUrl: "https://mikuapi.org/v1",
        protocol: "openai",
        imageModels: ["gpt-image-2"]
      }
    ]);

    const loaded = await store.loadProviders();
    expect(loaded[0]?.name).toBe("Miku API renamed");
    expect(loaded[0]?.apiKey).toBe("sk-old");
    expect(loaded[0]?.imageModels).toEqual(["gpt-image-2"]);
  });

  it("describes provider readiness for empty, missing key, and configured states", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "providers-"));
    const store = createProviderStore(path.join(tempDir, "providers.json"));

    await expect(store.describeReadiness()).resolves.toEqual({
      ready: false,
      reason: "no_provider",
      message: "未配置 API 平台"
    });

    await store.saveProviders([
      {
        id: "miku",
        name: "Miku API",
        baseUrl: "https://mikuapi.org/v1",
        protocol: "openai",
        enabled: true,
        primary: true,
        imageModels: ["gpt-image-2"]
      }
    ]);

    await expect(store.describeReadiness()).resolves.toEqual({
      ready: false,
      reason: "missing_key",
      message: "Miku API 缺少 API Key",
      primaryProviderId: "miku"
    });

    await store.saveProviders([
      {
        id: "miku",
        name: "Miku API",
        baseUrl: "https://mikuapi.org/v1",
        protocol: "openai",
        enabled: true,
        primary: true,
        apiKey: "sk-1234567890abcdef",
        imageModels: ["gpt-image-2"]
      }
    ]);

    await expect(store.describeReadiness()).resolves.toEqual({
      ready: true,
      reason: "ready",
      message: "Miku API 已可用于生成",
      primaryProviderId: "miku"
    });
  });
});

describe("model classification", () => {
  it("classifies image, chat, and video model ids", () => {
    expect(classifyModelId("gpt-image-2")).toBe("image");
    expect(classifyModelId("sora-2")).toBe("video");
    expect(classifyModelId("gpt-5.2")).toBe("chat");
  });
});

describe("provider capability normalization", () => {
  it("marks text2img available when image models exist", () => {
    const capabilities = normalizeProviderCapabilities({
      protocol: "openai",
      imageModels: ["gpt-image-2"],
      chatModels: [],
      videoModels: []
    });

    expect(capabilities.text2img.status).toBe("available");
  });

  it("marks img2img available for image models and protocol inference", () => {
    const imageModelCapabilities = normalizeProviderCapabilities({
      protocol: "openai",
      imageModels: ["gpt-image-2"],
      chatModels: [],
      videoModels: []
    });
    const protocolCapabilities = normalizeProviderCapabilities({
      protocol: "apimart",
      imageModels: [],
      chatModels: [],
      videoModels: []
    });

    expect(imageModelCapabilities.img2img.status).toBe("available");
    expect(protocolCapabilities.img2img.status).toBe("inferred");
  });

  it("keeps openai and apimart inferred capability states visible", () => {
    const openai = normalizeProviderCapabilities({
      protocol: "openai",
      imageModels: [],
      chatModels: [],
      videoModels: []
    });
    const apimart = normalizeProviderCapabilities({
      protocol: "apimart",
      imageModels: [],
      chatModels: [],
      videoModels: []
    });

    expect(openai.inpaint.status).toBe("inferred");
    expect(openai.video.status).toBe("inferred");
    expect(openai.llm.status).toBe("inferred");
    expect(apimart.inpaint.status).toBe("inferred");
    expect(apimart.video.status).toBe("inferred");
    expect(apimart.llm.status).toBe("inferred");
  });

  it("returns a stable capability field order and shape", () => {
    const capabilities = normalizeProviderCapabilities({
      protocol: "openai",
      imageModels: ["gpt-image-2"],
      chatModels: ["gpt-5.2"],
      videoModels: ["sora-2"]
    });

    expect(Object.keys(capabilities)).toEqual(["text2img", "img2img", "inpaint", "video", "llm"]);
    expect(capabilities).toMatchObject({
      text2img: { label: "文生图", status: "available", source: "model" },
      img2img: { label: "图生图", status: "available", source: "model" },
      inpaint: { label: "局部重绘", status: "inferred", source: "protocol" },
      video: { label: "视频", status: "available", source: "model" },
      llm: { label: "LLM", status: "available", source: "model" }
    });
  });
});
