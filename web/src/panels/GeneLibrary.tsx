import React from "react";
import { Dna, GitBranch, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { WorkflowGeneScope } from "../canvas/ReferenceCanvas";
import { countGeneTypes, geneDisplayMeta, type GeneTemplate } from "./geneLibraryModel";

export function GeneLibraryPopover({
  geneScope,
  genes,
  onAddGene,
  onClose,
  onDeleteGene,
  onGeneScopeChange,
  onRenameGene,
  onUseGene
}: {
  geneScope: WorkflowGeneScope;
  genes: GeneTemplate[];
  onAddGene: () => void;
  onClose: () => void;
  onDeleteGene: (gene: GeneTemplate) => void;
  onGeneScopeChange: (scope: WorkflowGeneScope) => void;
  onRenameGene: (gene: GeneTemplate) => void;
  onUseGene: (gene: GeneTemplate) => void;
}) {
  const counts = countGeneTypes(genes);

  return (
    <div className="gene-library-popover" role="dialog" aria-label="基因库">
      <header>
        <span>
          <Dna aria-hidden="true" size={16} />
          基因库
        </span>
        <button type="button" onClick={onClose} title="关闭">
          <X aria-hidden="true" size={15} />
        </button>
      </header>
      <div className="gene-library-stats" aria-label="基因数量">
        <span>{counts.total} 个基因</span>
        <span>{counts.prompt} 提示词</span>
        <span>{counts.workflow} 流程</span>
      </div>
      <div className="gene-scope-tabs" aria-label="流程保存范围">
        {geneScopeOptions.map((option) => (
          <button
            type="button"
            key={option.scope}
            className={geneScope === option.scope ? "is-active" : ""}
            onClick={() => onGeneScopeChange(option.scope)}
            title={option.title}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="gene-library-list" data-columns="3">
        {genes.length ? (
          genes.map((gene) => {
            const meta = geneDisplayMeta(gene);

            return (
              <div className={`gene-tile is-${gene.type}`} key={gene.id}>
                <button
                  type="button"
                  className={`gene-chip is-${gene.type}`}
                  data-testid="gene-chip"
                  onClick={() => onUseGene(gene)}
                  title={gene.type === "prompt" ? gene.prompt : `${gene.nodeCount} 个节点`}
                >
                  <span className="gene-chip-topline">
                    {gene.type === "prompt" ? (
                      <Sparkles aria-hidden="true" size={15} />
                    ) : (
                      <GitBranch aria-hidden="true" size={15} />
                    )}
                    <small>{meta.typeLabel}</small>
                  </span>
                  <span className="gene-chip-name">{gene.name}</span>
                  <small className="gene-chip-action">{meta.actionLabel}</small>
                  <small className="gene-chip-detail">{meta.detail}</small>
                </button>
                <div className="gene-tile-actions" aria-label={`${gene.name} 操作`}>
                  <button type="button" data-testid="gene-rename-button" onClick={() => onRenameGene(gene)} title="重命名">
                    <Pencil aria-hidden="true" size={12} />
                  </button>
                  <button type="button" data-testid="gene-delete-button" onClick={() => onDeleteGene(gene)} title="删除">
                    <Trash2 aria-hidden="true" size={12} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="gene-empty">还没有基因</div>
        )}
      </div>
      <button type="button" className="gene-add-button" data-testid="gene-add-button" onClick={onAddGene}>
        <Plus aria-hidden="true" size={16} />
        添加基因
      </button>
    </div>
  );
}

const geneScopeOptions: Array<{ scope: WorkflowGeneScope; label: string; title: string }> = [
  { scope: "selection", label: "选中", title: "只保存当前选中的节点和内部连线" },
  { scope: "selectionWithOutputs", label: "加输出", title: "保存选中节点，并带上直接连接的 Output 节点" },
  { scope: "canvas", label: "全画布", title: "保存当前画布上的所有节点和连线" }
];
