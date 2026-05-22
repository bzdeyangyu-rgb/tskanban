import { describe, expect, it } from "vitest";
import { createPromptGene, loadGenes, saveGenes, storageKey, type GeneStorage } from "./geneLibraryModel";

describe("geneLibraryModel", () => {
  it("loads an empty list when storage is missing or invalid", () => {
    const emptyStorage: GeneStorage = { getItem: () => null, setItem: () => undefined };
    const invalidStorage: GeneStorage = { getItem: () => "{bad", setItem: () => undefined };

    expect(loadGenes(emptyStorage)).toEqual([]);
    expect(loadGenes(invalidStorage)).toEqual([]);
    expect(loadGenes(undefined)).toEqual([]);
  });

  it("saves and loads prompt genes", () => {
    const records = new Map<string, string>();
    const storage: GeneStorage = {
      getItem: (key) => records.get(key) ?? null,
      setItem: (key, value) => {
        records.set(key, value);
      }
    };
    const gene = createPromptGene("未来城市，雨夜霓虹", [], "2026-05-22T09:00:00.000Z");

    saveGenes(storage, [gene]);

    expect(records.has(storageKey)).toBe(true);
    expect(loadGenes(storage)).toEqual([gene]);
  });

  it("creates sequential prompt gene names", () => {
    const first = createPromptGene("第一段提示词", [], "2026-05-22T09:00:00.000Z");
    const second = createPromptGene("第二段提示词", [first], "2026-05-22T09:01:00.000Z");

    expect(first.name).toBe("基因 1");
    expect(second.name).toBe("基因 2");
    expect(second.type).toBe("prompt");
  });
});
