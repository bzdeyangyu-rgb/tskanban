# 基因库实现计划

> **给执行代理：** 必须使用 `superpowers:executing-plans` 按任务推进。每一步使用 checkbox 追踪。

**目标：** 把无限画布右上角的 `MS生成` 替换为 `基因库`，第一版支持保存提示词基因并点击基因生成提示词节点。

**架构：** `App.tsx` 负责基因库开关、调用画布和状态提示；`GeneLibraryPopover` 负责面板 UI；`geneLibraryModel.ts` 负责本地存储和纯逻辑；`ReferenceCanvas` 暴露 `promptGeneSource()` 让基因库按“选中提示词优先，否则最新提示词”读取内容。

**技术栈：** React、TypeScript、Vite、Vitest、本地 `localStorage`。

---

### Task 1: 基因库纯逻辑

**Files:**
- Create: `web/src/panels/geneLibraryModel.ts`
- Test: `web/src/panels/geneLibraryModel.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `web/src/panels/geneLibraryModel.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { createPromptGene, loadGenes, saveGenes, storageKey, type GeneStorage } from "./geneLibraryModel";

describe("geneLibraryModel", () => {
  it("loads an empty list when storage is missing or invalid", () => {
    const emptyStorage: GeneStorage = { getItem: () => null, setItem: () => undefined };
    const invalidStorage: GeneStorage = { getItem: () => "{bad", setItem: () => undefined };

    expect(loadGenes(emptyStorage)).toEqual([]);
    expect(loadGenes(invalidStorage)).toEqual([]);
  });

  it("saves and loads prompt genes", () => {
    const records = new Map<string, string>();
    const storage: GeneStorage = {
      getItem: (key) => records.get(key) ?? null,
      setItem: (key, value) => records.set(key, value)
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm.cmd test -- --run web/src/panels/geneLibraryModel.test.ts`

Expected: FAIL，提示找不到 `geneLibraryModel`。

- [ ] **Step 3: 实现纯逻辑**

创建 `web/src/panels/geneLibraryModel.ts`：

```ts
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

function nextGeneNumber(existing: GeneTemplate[]): number {
  return existing.filter((gene) => gene.type === "prompt").length + 1;
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
    return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.createdAt === "string";
  }
  return false;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm.cmd test -- --run web/src/panels/geneLibraryModel.test.ts`

Expected: PASS。

### Task 2: 画布暴露提示词来源

**Files:**
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Test: `web/src/canvas/ReferenceCanvas.model.test.ts`

- [ ] **Step 1: 写失败测试**

在 `web/src/canvas/ReferenceCanvas.model.test.ts` 增加：

```ts
import { promptGeneSourceFromNodes } from "./ReferenceCanvas";

it("uses selected prompt before newest prompt for gene capture", () => {
  const nodes = [
    { id: "old", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: { text: "旧提示词" }, status: "idle" },
    { id: "image", type: "image", x: 0, y: 0, width: 100, height: 100, data: {}, status: "idle" },
    { id: "new", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: { text: "新提示词" }, status: "idle" }
  ] as const;

  expect(promptGeneSourceFromNodes(nodes, ["old"])).toEqual({ prompt: "旧提示词", sourceNodeId: "old" });
  expect(promptGeneSourceFromNodes(nodes, [])).toEqual({ prompt: "新提示词", sourceNodeId: "new" });
});
```

- [ ] **Step 2: 实现 helper 和 ref 方法**

在 `ReferenceCanvasHandle` 增加：

```ts
promptGeneSource: () => { prompt: string; sourceNodeId: string } | undefined;
```

在 `useImperativeHandle` 返回对象增加：

```ts
promptGeneSource: () => promptGeneSourceFromNodes(nodes, selectedIds),
```

在文件底部导出：

```ts
export function promptGeneSourceFromNodes(
  nodes: readonly Pick<CanvasNode, "id" | "type" | "data">[],
  selectedIds: readonly string[]
): { prompt: string; sourceNodeId: string } | undefined {
  const selected = nodes.find((node) => selectedIds.includes(node.id) && node.type === "prompt");
  const selectedPrompt = selected ? stringValue(selected.data.text).trim() : "";
  if (selected && selectedPrompt) {
    return { prompt: selectedPrompt, sourceNodeId: selected.id };
  }

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    const prompt = node.type === "prompt" ? stringValue(node.data.text).trim() : "";
    if (prompt) {
      return { prompt, sourceNodeId: node.id };
    }
  }

  return undefined;
}
```

- [ ] **Step 3: 运行模型测试**

Run: `npm.cmd test -- --run web/src/canvas/ReferenceCanvas.model.test.ts`

Expected: PASS。

### Task 3: 基因库 UI 和 App 集成

**Files:**
- Create: `web/src/panels/GeneLibrary.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 创建 GeneLibraryPopover**

创建 `web/src/panels/GeneLibrary.tsx`：

```tsx
import { Dna, Plus, Sparkles, X } from "lucide-react";
import type { GeneTemplate } from "./geneLibraryModel";

export function GeneLibraryPopover({
  genes,
  onAddGene,
  onClose,
  onUseGene
}: {
  genes: GeneTemplate[];
  onAddGene: () => void;
  onClose: () => void;
  onUseGene: (gene: GeneTemplate) => void;
}) {
  const promptGenes = genes.filter((gene) => gene.type === "prompt");

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
        {promptGenes.length ? (
          promptGenes.map((gene) => (
            <button type="button" key={gene.id} className="gene-chip" onClick={() => onUseGene(gene)} title={gene.prompt}>
              <Sparkles aria-hidden="true" size={15} />
              <span>{gene.name}</span>
            </button>
          ))
        ) : (
          <div className="gene-empty">还没有基因</div>
        )}
      </div>
      <button type="button" className="gene-add-button" onClick={onAddGene}>
        <Plus aria-hidden="true" size={16} />
        添加基因
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 在 App 接入状态和事件**

在 `App.tsx` 增加导入：

```ts
import { GeneLibraryPopover } from "./panels/GeneLibrary";
import { createPromptGene, loadGenes, saveGenes, type GeneTemplate } from "./panels/geneLibraryModel";
```

增加状态：

```ts
const [genes, setGenes] = useState<GeneTemplate[]>(() => loadGenes(typeof window === "undefined" ? undefined : window.localStorage));
const [isGeneLibraryOpen, setIsGeneLibraryOpen] = useState(false);
```

增加保存 effect：

```ts
useEffect(() => {
  saveGenes(typeof window === "undefined" ? undefined : window.localStorage, genes);
}, [genes]);
```

增加处理函数：

```ts
const handleAddGene = useCallback(() => {
  const source = canvasRef.current?.promptGeneSource();
  if (!source) {
    setStatus("请先创建或选择提示词节点");
    return;
  }
  setGenes((current) => [createPromptGene(source.prompt, current), ...current]);
  setStatus("已添加基因");
}, []);

const handleUseGene = useCallback(
  (gene: GeneTemplate) => {
    if (gene.type !== "prompt") {
      setStatus("工作流基因稍后开放");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatus("画布还在加载");
      return;
    }
    const definition = nodeDefinition("prompt", providers[0]?.id);
    canvas.addNode({ ...definition, data: { ...definition.data, text: gene.prompt } });
    setStatus(`已放置 ${gene.name}`);
    setIsGeneLibraryOpen(false);
  },
  [providers]
);
```

- [ ] **Step 3: 替换工具栏按钮**

把 `CanvasEditorTopbar` 的 props 增加：

```ts
isGeneLibraryOpen: boolean;
onAddGene: () => void;
onGeneLibraryToggle: () => void;
onGeneLibraryClose: () => void;
onUseGene: (gene: GeneTemplate) => void;
genes: GeneTemplate[];
```

把 `MS生成` 按钮替换为：

```tsx
<div className="gene-toolbar-slot">
  <ToolbarButton title="基因库" label="基因库" icon={Dna} onClick={onGeneLibraryToggle} />
  {isGeneLibraryOpen ? <GeneLibraryPopover genes={genes} onAddGene={onAddGene} onClose={onGeneLibraryClose} onUseGene={onUseGene} /> : null}
</div>
```

- [ ] **Step 4: 增加样式**

在 `web/styles.css` 增加：

```css
.gene-toolbar-slot {
  position: relative;
  display: inline-flex;
}

.gene-library-popover {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  z-index: 40;
  width: 260px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  background: #0f1724;
  box-shadow: 0 22px 54px rgba(0, 0, 0, 0.38);
}

.gene-library-popover header,
.gene-library-popover header span {
  display: flex;
  align-items: center;
}

.gene-library-popover header {
  justify-content: space-between;
  margin-bottom: 10px;
  color: #e5e9f0;
  font-size: 13px;
  font-weight: 900;
}

.gene-library-popover header span {
  gap: 7px;
}

.gene-library-popover header button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  color: #9aa6b8;
  background: #0b111a;
}

.gene-library-list {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
  scrollbar-width: none;
}

.gene-library-list::-webkit-scrollbar {
  display: none;
}

.gene-chip,
.gene-add-button {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.gene-chip {
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: #d8dee9;
  background: #111827;
}

.gene-add-button {
  width: 100%;
  justify-content: center;
  margin-top: 10px;
  border: 0;
  color: #0b111a;
  background: #edf2fa;
}

.gene-empty {
  padding: 18px 12px;
  border: 1px dashed rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  color: #8ea3c4;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
}
```

### Task 4: 验证和提交

**Files:**
- Modify as needed after QA.

- [ ] **Step 1: 全量测试**

Run: `npm.cmd test -- --run`

Expected: 15+ test files pass.

- [ ] **Step 2: 构建**

Run: `npm.cmd run build`

Expected: build succeeds.

- [ ] **Step 3: 浏览器验证**

打开 `http://127.0.0.1:5174/`：

- 进入无限画布。
- 确认右上角显示 `基因库`，不显示 `MS生成`。
- 选中提示词节点，点击 `基因库`，点击 `添加基因`。
- 确认出现 `基因 1`。
- 点击 `基因 1`，确认画布新增一个提示词节点，内容与原提示词一致。

- [ ] **Step 4: 提交**

Run:

```powershell
git add web/src/App.tsx web/src/canvas/ReferenceCanvas.tsx web/src/panels/GeneLibrary.tsx web/src/panels/geneLibraryModel.ts web/src/panels/geneLibraryModel.test.ts web/src/canvas/ReferenceCanvas.model.test.ts web/styles.css
git commit -m "feat: add prompt gene library"
git push -u origin codex/gene-library
```

