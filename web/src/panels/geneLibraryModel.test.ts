import { describe, expect, it } from "vitest";
import {
  createPromptGene,
  createWorkflowGene,
  loadGenes,
  nextPromptGeneName,
  nextWorkflowGeneName,
  saveGenes,
  storageKey,
  type GeneStorage
} from "./geneLibraryModel";

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

  it("uses trimmed custom names and falls back to generated names", () => {
    const promptGene = createPromptGene("霓虹雨夜", [], "2026-05-22T09:00:00.000Z", "  城市夜景  ");
    const fallbackGene = createPromptGene("霓虹雨夜", [promptGene], "2026-05-22T09:01:00.000Z", "   ");

    expect(promptGene.name).toBe("城市夜景");
    expect(fallbackGene.name).toBe("基因 2");
  });

  it("creates workflow genes with node counts", () => {
    const gene = createWorkflowGene(
      {
        canvasId: "gene",
        nodes: [
          { id: "a", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: {} },
          { id: "b", type: "api_text2img", x: 130, y: 0, width: 100, height: 100, data: {} }
        ],
        edges: [{ id: "e", from: "a", to: "b" }],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      [],
      "2026-05-22T09:02:00.000Z"
    );

    expect(gene.type).toBe("workflow");
    expect(gene.name).toBe("流程基因 1");
    expect(gene.nodeCount).toBe(2);
  });

  it("exposes default names for save prompts", () => {
    const promptGene = createPromptGene("霓虹雨夜", [], "2026-05-22T09:00:00.000Z");
    const workflowGene = createWorkflowGene(
      {
        canvasId: "gene",
        nodes: [
          { id: "a", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: {} },
          { id: "b", type: "api_text2img", x: 130, y: 0, width: 100, height: 100, data: {} }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      [promptGene],
      "2026-05-22T09:02:00.000Z"
    );

    expect(nextPromptGeneName([promptGene, workflowGene])).toBe("基因 2");
    expect(nextWorkflowGeneName([promptGene, workflowGene])).toBe("流程基因 2");
  });
});
