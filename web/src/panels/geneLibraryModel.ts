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

export type GeneDisplayMeta = {
  typeLabel: string;
  actionLabel: string;
  detail: string;
};

export type GeneTypeCounts = {
  total: number;
  prompt: number;
  workflow: number;
};

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

export function createPromptGene(
  prompt: string,
  existing: GeneTemplate[],
  createdAt = new Date().toISOString(),
  name?: string
): PromptGeneTemplate {
  return {
    id: `gene_${Date.now().toString(36)}_${existing.length}`,
    type: "prompt",
    name: normalizedGeneName(name) || nextPromptGeneName(existing),
    prompt,
    createdAt
  };
}

export function createWorkflowGene(
  snapshot: CanvasSnapshot,
  existing: GeneTemplate[],
  createdAt = new Date().toISOString(),
  name?: string
): WorkflowGeneTemplate {
  return {
    id: `gene_${Date.now().toString(36)}_${existing.length}`,
    type: "workflow",
    name: normalizedGeneName(name) || nextWorkflowGeneName(existing),
    snapshot,
    nodeCount: snapshot.nodes.length,
    createdAt
  };
}

export function nextPromptGeneName(existing: GeneTemplate[]): string {
  return `基因 ${nextGeneNumber(existing, "prompt")}`;
}

export function nextWorkflowGeneName(existing: GeneTemplate[]): string {
  return `流程基因 ${nextGeneNumber(existing, "workflow")}`;
}

export function geneDisplayMeta(gene: GeneTemplate): GeneDisplayMeta {
  if (gene.type === "workflow") {
    return {
      typeLabel: "流程",
      actionLabel: "导入流程",
      detail: `${gene.nodeCount} 节点`
    };
  }

  return {
    typeLabel: "提示词",
    actionLabel: "生成提示词",
    detail: compactPrompt(gene.prompt)
  };
}

export function countGeneTypes(genes: GeneTemplate[]): GeneTypeCounts {
  return genes.reduce<GeneTypeCounts>(
    (counts, gene) => ({
      total: counts.total + 1,
      prompt: counts.prompt + (gene.type === "prompt" ? 1 : 0),
      workflow: counts.workflow + (gene.type === "workflow" ? 1 : 0)
    }),
    { total: 0, prompt: 0, workflow: 0 }
  );
}

function nextGeneNumber(existing: GeneTemplate[], type: GeneTemplate["type"]): number {
  return existing.filter((gene) => gene.type === type).length + 1;
}

function normalizedGeneName(name: string | undefined): string {
  return name?.trim() ?? "";
}

function compactPrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "空提示词";
  }
  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
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
