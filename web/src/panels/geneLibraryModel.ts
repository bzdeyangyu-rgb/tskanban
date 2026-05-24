import type { CanvasSnapshot } from "../canvas/flowTypes";

export const storageKey = "tshuabu:geneLibrary";

export type PromptGeneTemplate = {
  id: string;
  type: "prompt";
  name: string;
  prompt: string;
  createdAt: string;
};

export type WorkflowGeneTemplate = {
  id: string;
  type: "workflow";
  name: string;
  snapshot: CanvasSnapshot;
  nodeCount: number;
  createdAt: string;
};

export type GeneTemplate = PromptGeneTemplate | WorkflowGeneTemplate;

export type GeneStorage = Pick<Storage, "getItem" | "setItem">;

export function loadGenes(storage: GeneStorage | undefined): GeneTemplate[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGeneTemplate) : [];
  } catch {
    return [];
  }
}

export function saveGenes(storage: GeneStorage | undefined, genes: GeneTemplate[]): void {
  if (!storage) {
    return;
  }
  storage.setItem(storageKey, JSON.stringify(genes));
}

export function createPromptGene(prompt: string, existing: GeneTemplate[], createdAt = new Date().toISOString()): PromptGeneTemplate {
  return {
    id: `gene_${Date.now().toString(36)}_${existing.length}`,
    type: "prompt",
    name: `基因 ${nextGeneNumber(existing)}`,
    prompt,
    createdAt
  };
}

export function createWorkflowGene(
  snapshot: CanvasSnapshot,
  existing: GeneTemplate[],
  createdAt = new Date().toISOString()
): WorkflowGeneTemplate {
  return {
    id: `gene_${Date.now().toString(36)}_${existing.length}`,
    type: "workflow",
    name: `流程基因 ${nextWorkflowNumber(existing)}`,
    snapshot,
    nodeCount: snapshot.nodes.length,
    createdAt
  };
}

function nextGeneNumber(existing: GeneTemplate[]): number {
  return existing.filter((gene) => gene.type === "prompt").length + 1;
}

function nextWorkflowNumber(existing: GeneTemplate[]): number {
  return existing.filter((gene) => gene.type === "workflow").length + 1;
}

function isGeneTemplate(value: unknown): value is GeneTemplate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GeneTemplate>;
  if (candidate.type === "prompt") {
    return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.prompt === "string";
  }
  if (candidate.type === "workflow") {
    return (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.createdAt === "string" &&
      Boolean(candidate.snapshot)
    );
  }
  return false;
}
