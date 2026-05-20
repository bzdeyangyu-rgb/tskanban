import { describe, expect, it } from "vitest";
import { imageFilesFromList } from "./importImages";

describe("imageFilesFromList", () => {
  it("keeps only jpg and png files", () => {
    const files = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
      new File(["c"], "c.txt", { type: "text/plain" })
    ];

    expect(imageFilesFromList(files).map((file) => file.name)).toEqual(["a.png", "b.jpg"]);
  });
});
