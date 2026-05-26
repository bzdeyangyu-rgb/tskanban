import { describe, expect, it } from "vitest";
import { featurePageConfig, managementStatsForFeature, type ApiFeaturePageId } from "./studioFeatureModel";

describe("studio feature page model", () => {
  it("gives text-to-image a size control and batch/version management", () => {
    const config = featurePageConfig("zimage");

    expect(config.fields.map((field) => field.label)).toContain("尺寸");
    expect(managementStatsForFeature("zimage").map((item) => item.label)).toEqual(["当前版本", "批量队列", "历史记录"]);
  });

  it("gives detail enhance the expected strength, preview, and management surfaces", () => {
    const config = featurePageConfig("enhance");

    expect(config.uploadLabel).toBe("输入图片");
    expect(config.previewTitle).toBe("画布预览");
    expect(config.fields.map((field) => field.label)).toContain("增强程度");
    expect(managementStatsForFeature("enhance").map((item) => item.label)).toContain("增强记录");
  });

  it("gives image edit reference, prompt, preview, and management controls without a negative prompt field", () => {
    const config = featurePageConfig("klein");

    expect(config.uploadLabel).toBe("参考图片");
    expect(config.promptLabel).toBe("输入提示词");
    expect(config.hasNegativePrompt).toBe(false);
    expect(config.fields.map((field) => field.label)).toContain("参考权重");
  });

  it("gives angle control image, camera, parameter, and result surfaces", () => {
    const config = featurePageConfig("angle");

    expect(config.uploadLabel).toBe("输入图片");
    expect(config.fields.map((field) => field.label)).toEqual(["相机控制", "焦距", "参数强度"]);
    expect(config.previewTitle).toBe("结果预览");
  });

  it("keeps every feature page explicit so empty pages cannot silently ship", () => {
    const pages: ApiFeaturePageId[] = ["zimage", "enhance", "klein", "angle", "online", "gpt-chat"];

    for (const pageId of pages) {
      const config = featurePageConfig(pageId);
      expect(config.fields.length).toBeGreaterThan(0);
      expect(config.managementTitle.length).toBeGreaterThan(0);
      expect(config.previewTitle.length).toBeGreaterThan(0);
    }
  });
});
