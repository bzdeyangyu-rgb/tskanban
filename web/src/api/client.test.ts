import { afterEach, describe, expect, it, vi } from "vitest";
import { executeCanvasFlow, fetchProviderList, saveProviderList } from "./client";

const provider = {
  id: "miku",
  name: "Miku API",
  baseUrl: "https://mikuapi.org/v1",
  protocol: "openai" as const,
  enabled: true,
  primary: true,
  imageModels: ["gpt-image-2"],
  chatModels: [],
  videoModels: [],
  hasKey: true,
  keyPreview: "sk-...cdef",
  capabilities: {
    text2img: { label: "文生图", status: "available" as const, source: "model" as const, modelCount: 1, reason: "ok" },
    img2img: { label: "图生图", status: "available" as const, source: "model" as const, modelCount: 1, reason: "ok" },
    inpaint: { label: "局部重绘", status: "inferred" as const, source: "protocol" as const, modelCount: 0, reason: "ok" },
    video: { label: "视频", status: "inferred" as const, source: "protocol" as const, modelCount: 0, reason: "ok" },
    llm: { label: "LLM", status: "inferred" as const, source: "protocol" as const, modelCount: 0, reason: "ok" }
  }
};

function jsonResponse(body: unknown) {
  return {
    json: async () => body
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client provider state", () => {
  it("returns provider readiness metadata from fetchProviderList", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          data: [],
          meta: { readiness: { ready: false, reason: "no_provider", message: "未配置 API 平台" } }
        })
      )
    );

    await expect(fetchProviderList()).resolves.toEqual({
      providers: [],
      readiness: { ready: false, reason: "no_provider", message: "未配置 API 平台" }
    });
  });

  it("returns provider readiness metadata after saveProviderList", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          data: [provider],
          meta: { readiness: { ready: true, reason: "ready", message: "Miku API 已可用于生成", primaryProviderId: "miku" } }
        })
      )
    );

    await expect(saveProviderList([{ ...provider, apiKey: "sk-1234567890abcdef" }])).resolves.toMatchObject({
      providers: [provider],
      readiness: { ready: true, reason: "ready", primaryProviderId: "miku" }
    });
  });

  it("throws flow execution errors even when the server includes failure data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: false,
          error: "no API provider configured",
          data: { run: { errorMessage: "no API provider configured" } }
        })
      )
    );

    await expect(
      executeCanvasFlow({
        canvasId: "c1",
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      })
    ).rejects.toThrow("no API provider configured");
  });
});
