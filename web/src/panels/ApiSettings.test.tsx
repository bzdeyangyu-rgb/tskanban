import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ApiProvider } from "../api/client";
import { ApiSettings } from "./ApiSettings";

const capabilities: ApiProvider["capabilities"] = {
  text2img: { label: "文生图", status: "available", source: "model", modelCount: 1, reason: "ok" },
  img2img: { label: "图生图", status: "available", source: "model", modelCount: 1, reason: "ok" },
  inpaint: { label: "局部重绘", status: "inferred", source: "protocol", modelCount: 0, reason: "ok" },
  video: { label: "视频", status: "unavailable", source: "none", modelCount: 0, reason: "none" },
  llm: { label: "LLM", status: "unavailable", source: "none", modelCount: 0, reason: "none" }
};

describe("ApiSettings", () => {
  it("shows a clear unavailable state when no provider is configured", () => {
    const html = renderToStaticMarkup(<ApiSettings providers={[]} onProvidersChange={() => undefined} />);

    expect(html).toContain("未配置 API 平台");
    expect(html).toContain("画布生成暂不可用");
    expect(html).toContain("API Key");
  });

  it("shows a missing-key state for providers without saved keys", () => {
    const provider: ApiProvider = {
      id: "miku",
      name: "Miku API",
      baseUrl: "https://mikuapi.org/v1",
      protocol: "openai",
      enabled: true,
      primary: true,
      imageModels: ["gpt-image-2"],
      chatModels: [],
      videoModels: [],
      hasKey: false,
      keyPreview: "",
      capabilities
    };
    const html = renderToStaticMarkup(<ApiSettings providers={[provider]} onProvidersChange={() => undefined} />);

    expect(html).toContain("Miku API 缺少 API Key");
    expect(html).toContain("生成暂不可用");
  });

  it("shows a ready state for providers with saved keys", () => {
    const provider: ApiProvider = {
      id: "miku",
      name: "Miku API",
      baseUrl: "https://mikuapi.org/v1",
      protocol: "openai",
      enabled: true,
      primary: true,
      imageModels: ["gpt-image-2"],
      chatModels: [],
      videoModels: [],
      hasKey: true,
      keyPreview: "sk-...cdef",
      capabilities
    };
    const html = renderToStaticMarkup(<ApiSettings providers={[provider]} onProvidersChange={() => undefined} />);

    expect(html).toContain("Miku API 已可用于生成");
  });
});
