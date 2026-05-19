import { describe, expect, it } from "vitest";
import { extractOutputAssets } from "./imageApi";

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
