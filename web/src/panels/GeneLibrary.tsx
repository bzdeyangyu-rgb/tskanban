import { Dna, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { GeneTemplate } from "./geneLibraryModel";

export function GeneLibraryPopover({
  genes,
  onAddGene,
  onClose,
  onDeleteGene,
  onRenameGene,
  onUseGene
}: {
  genes: GeneTemplate[];
  onAddGene: () => void;
  onClose: () => void;
  onDeleteGene: (gene: GeneTemplate) => void;
  onRenameGene: (gene: GeneTemplate) => void;
  onUseGene: (gene: GeneTemplate) => void;
}) {
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
      <div className="gene-library-list">
        {genes.length ? (
          genes.map((gene) => (
            <div className="gene-tile" key={gene.id}>
              <button
                type="button"
                className="gene-chip"
                data-testid="gene-chip"
                onClick={() => onUseGene(gene)}
                title={gene.type === "prompt" ? gene.prompt : `${gene.nodeCount} 个节点`}
              >
                <Sparkles aria-hidden="true" size={15} />
                <span>{gene.name}</span>
                {gene.type === "workflow" ? <small>{gene.nodeCount} 节点</small> : null}
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
          ))
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
