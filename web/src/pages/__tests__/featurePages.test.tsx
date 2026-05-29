import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../App";

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

  it("显示样例侧栏和底部设置入口", () => {
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
    expect(html).toContain("黑夜模式");
    expect(html).toContain("中文");
    expect(html).toContain("API 设置");
    expect(html).toContain("Side");
  });
});
