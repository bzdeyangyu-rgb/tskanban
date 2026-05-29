import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../App";
import { AngleControlPage } from "../AngleControlPage";
import { EnhancePage } from "../EnhancePage";
import { GptChatPage } from "../GptChatPage";
import { ImageEditPage } from "../ImageEditPage";
import { OnlineImagePage } from "../OnlineImagePage";
import { TextToImagePage } from "../TextToImagePage";

function installWindow() {
  const storage = new Map<string, string>();
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    },
    prompt: () => null
  } as unknown as Window & typeof globalThis;
}

describe("产品壳", () => {
  beforeEach(() => installWindow());

  it("显示样例侧栏和真实可用的底部设置入口", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('data-product-shell="reference"');
    expect(html).toContain('data-token-sidebar-expanded="326"');
    expect(html).toContain('data-token-sidebar-collapsed="64"');
    expect(html).toContain("文生图");
    expect(html).toContain("细节增强");
    expect(html).toContain("图片编辑");
    expect(html).toContain("角度控制");
    expect(html).toContain("在线生图");
    expect(html).toContain("GPT 对话");
    expect(html).toContain("无限画布");
    expect(html).not.toContain("黑夜模式");
    expect(html).not.toContain("中文");
    expect(html).toContain("API 设置");
    expect(html).toContain("Side");
  });
});

function expectFeatureLayout(html: string) {
  expect(html).toContain('data-feature-layout="three-column"');
  expect(html).toContain("参数区");
  expect(html).toContain("工作区");
  expect(html).toContain("管理区");
}

describe("功能页面", () => {
  it("文生图包含尺寸、批量、版本管理、提示词模板和预览", () => {
    const html = renderToStaticMarkup(<TextToImagePage />);

    expectFeatureLayout(html);
    expect(html).toContain("尺寸");
    expect(html).toContain("批量");
    expect(html).toContain("版本管理");
    expect(html).toContain("提示词模板");
    expect(html).toContain("生成预览");
  });

  it("细节增强包含输入图片、增强程度、预览和管理", () => {
    const html = renderToStaticMarkup(<EnhancePage />);

    expectFeatureLayout(html);
    expect(html).toContain("输入图片");
    expect(html).toContain("增强程度");
    expect(html).toContain("对比预览");
    expect(html).toContain("增强记录管理");
  });

  it("图片编辑包含输入提示词、参考、遮罩入口、预览和管理", () => {
    const html = renderToStaticMarkup(<ImageEditPage />);

    expectFeatureLayout(html);
    expect(html).toContain("输入提示词");
    expect(html).toContain("参考图片");
    expect(html).toContain("遮罩入口");
    expect(html).toContain("编辑预览");
    expect(html).toContain("图片编辑管理");
  });

  it("角度控制包含输入图片、相机控制、参数和结果", () => {
    const html = renderToStaticMarkup(<AngleControlPage />);

    expectFeatureLayout(html);
    expect(html).toContain("输入图片");
    expect(html).toContain("相机控制");
    expect(html).toContain("参数");
    expect(html).toContain("结果预览");
  });

  it("在线生图包含供应商、模型、提示词、尺寸和历史", () => {
    const html = renderToStaticMarkup(<OnlineImagePage />);

    expectFeatureLayout(html);
    expect(html).toContain("供应商");
    expect(html).toContain("模型");
    expect(html).toContain("提示词");
    expect(html).toContain("尺寸");
    expect(html).toContain("历史");
  });

  it("GPT 对话是消息流和底部输入框结构", () => {
    const html = renderToStaticMarkup(<GptChatPage />);

    expect(html).toContain('data-chat-layout="thread-composer"');
    expect(html).toContain("chat-thread");
    expect(html).toContain("chat-composer");
    expect(html).toContain("输入你要问 GPT 的内容");
    expect(html).not.toContain('data-feature-layout="three-column"');
    expect(html).not.toContain("参数区");
  });
});
