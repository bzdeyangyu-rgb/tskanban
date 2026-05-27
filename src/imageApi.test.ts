import { describe, expect, it } from "vitest";
import { buildImageApiCall, extractOutputAssets } from "./imageApi";

describe("image api output extraction", () => {
  it("accepts OpenAI-compatible b64_json image responses", () => {
    expect(
      extractOutputAssets({
        data: [
          {
            b64_json: "abc123",
            revised_prompt: "test"
          }
        ]
      })
    ).toEqual(["data:image/png;base64,abc123"]);
  });
});

describe("image api request building", () => {
  it("routes OpenAI-compatible img2img provider calls through image edits with references", () => {
    const call = buildImageApiCall({
      request: {
        action: "img2img",
        model: "gpt-image-2",
        prompt: "make it red",
        params: { size: "1024x1024", count: 2 },
        inputImage: "data:image/png;base64,abc"
      },
      baseUrl: "https://mikuapi.org/v1",
      apiKey: "sk-test",
      protocol: "openai"
    });

    expect(call.url).toBe("https://mikuapi.org/v1/images/edits");
    expect(call.payload).toMatchObject({
      model: "gpt-image-2",
      prompt: "make it red",
      size: "1024x1024",
      n: 2,
      images: [{ image_url: "data:image/png;base64,abc" }]
    });
    expect(call.payload).not.toHaveProperty("count");
    expect(call.payload).not.toHaveProperty("image");
    expect(call.payload).not.toHaveProperty("input_image");
  });

  it("routes inpaint provider calls through image edits with a mask reference", () => {
    const call = buildImageApiCall({
      request: {
        action: "inpaint",
        model: "gpt-image-2",
        prompt: "replace the logo",
        inputImage: "data:image/png;base64,base",
        maskImage: "data:image/png;base64,mask"
      },
      baseUrl: "https://mikuapi.org",
      apiKey: "sk-test",
      protocol: "openai"
    });

    expect(call.url).toBe("https://mikuapi.org/v1/images/edits");
    expect(call.payload).toMatchObject({
      images: [{ image_url: "data:image/png;base64,base" }],
      mask: { image_url: "data:image/png;base64,mask" }
    });
  });

  it("routes video provider calls to the video generation endpoint", () => {
    const call = buildImageApiCall({
      request: {
        action: "video",
        model: "sora-test",
        prompt: "a short product clip"
      },
      baseUrl: "https://mikuapi.org",
      apiKey: "sk-test",
      protocol: "openai"
    });

    expect(call.url).toBe("https://mikuapi.org/v1/videos/generations");
  });
});
