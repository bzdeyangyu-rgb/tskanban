import { describe, expect, it } from "vitest";
import { normalizeProviderCapabilities } from "../src/services/providers";

describe("provider protocol capabilities", () => {
  it("keeps capability keys stable for UI rendering", () => {
    const capabilities = normalizeProviderCapabilities({
      protocol: "openai",
      imageModels: [],
      chatModels: [],
      videoModels: []
    });

    expect(Object.keys(capabilities)).toEqual(["text2img", "img2img", "inpaint", "video", "llm"]);
  });
});
