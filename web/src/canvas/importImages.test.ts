import { describe, expect, it } from "vitest";
import { imageFilesFromClipboard, imageFilesFromList, isSupportedImageFile } from "./importImages";

describe("imageFilesFromList", () => {
  it("keeps only supported image files", () => {
    const files = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
      new File(["c"], "c.webp", { type: "image/webp" }),
      new File(["c"], "c.txt", { type: "text/plain" })
    ];

    expect(imageFilesFromList(files).map((file) => file.name)).toEqual(["a.png", "b.jpg", "c.webp"]);
  });

  it("keeps webp files from clipboard items", () => {
    const webp = new File(["webp"], "clip.webp", { type: "image/webp" });
    const text = new File(["text"], "note.txt", { type: "text/plain" });
    const items = [
      { kind: "file", getAsFile: () => webp },
      { kind: "file", getAsFile: () => text },
      { kind: "string", getAsFile: () => null }
    ] as unknown as DataTransferItemList;

    expect(imageFilesFromClipboard(items).map((file) => file.name)).toEqual(["clip.webp"]);
  });

  it("accepts image files by extension when mime type is missing", () => {
    const files = [
      new File(["a"], "a.PNG", { type: "" }),
      new File(["b"], "b.jpeg", { type: "" }),
      new File(["c"], "c.webp", { type: "" }),
      new File(["d"], "d.txt", { type: "" })
    ];

    expect(imageFilesFromList(files).map((file) => file.name)).toEqual(["a.PNG", "b.jpeg", "c.webp"]);
  });

  it("uses the same supported image rules for direct checks and clipboard files", () => {
    const pngWithoutMime = new File(["png"], "clipboard.png", { type: "" });
    const unsupported = new File(["gif"], "clip.gif", { type: "" });
    const items = [
      { kind: "file", getAsFile: () => pngWithoutMime },
      { kind: "file", getAsFile: () => unsupported }
    ] as unknown as DataTransferItemList;

    expect(isSupportedImageFile(pngWithoutMime)).toBe(true);
    expect(isSupportedImageFile(unsupported)).toBe(false);
    expect(imageFilesFromClipboard(items).map((file) => file.name)).toEqual(["clipboard.png"]);
  });
});
