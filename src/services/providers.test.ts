import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyModelId,
  createProviderStore,
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
});

describe("model classification", () => {
  it("classifies image, chat, and video model ids", () => {
    expect(classifyModelId("gpt-image-2")).toBe("image");
    expect(classifyModelId("sora-2")).toBe("video");
    expect(classifyModelId("gpt-5.2")).toBe("chat");
  });
});
