# Reference UI Parity Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第一阶段 UI 目标从“参考案例风格”修正为“照案例 UI 外壳和无限画布交互复刻，只替换我们自己的业务内核”。

**Architecture:** 案例的成熟 UI 分两层：`static/index.html` 的 studio 外壳负责侧栏、舞台、主题、底部品牌；`static/canvas.html` 的 canvas 层负责画布门页、节点、端口、SVG 连线、命令菜单。我们继续保留 React/TypeScript/现有后端，但 UI 结构、CSS token、侧栏 hover 展开、节点端口和连线命令流必须按案例实现，避免用 tldraw 默认箭头拼凑。

**Tech Stack:** React, TypeScript, Vite, tldraw 作为画布承载层, DOM/SVG overlay 作为案例同款连接交互层, Vitest, Playwright/browser manual verification.

---

## 当前判定

现在的问题不是“细节没调好”，而是两条技术路径混在一起：

- 案例连线：自研 DOM 节点端口 + SVG path 层 + `connections` 数据 + 临时线 + 命令菜单 + 自动创建节点。
- 我们当前连线：tldraw 自定义 shape 上塞一个按钮，然后创建 tldraw arrow binding。

所以现状会显得原始：线的视觉、端口热区、菜单位置、删除交互、hover 反馈都不在同一个系统里。接下来不能继续修补 tldraw arrow 外观，要把“线和端口”从 tldraw 默认箭头里抽出来，按案例的 overlay 机制做。

---

## 参考实现映射

- 侧栏外壳来源：`D:/Tskanban/references/Infinite-Canvas/static/index.html`
  - `.sidebar`: 默认 80px，hover 展开 220px。
  - `.nav-item`: 默认只显示图标，hover 后显示文字。
  - `.side-actions`: 底部 pill，hover 后显示文字。
  - `.author-box`: 底部作者标识，应改为 `Side`。
- 无限画布连线来源：`D:/Tskanban/references/Infinite-Canvas/static/canvas.html`
  - `.port`: 节点左右端口和 44px 热区。
  - `startLink`: 拖出临时线。
  - `openLinkCreateMenu`: 松手后打开命令菜单。
  - `createLinkedNode`: 选择命令后创建节点并自动连接。
  - `renderLinks`: 用 SVG path 渲染所有连接线。
  - `linkDeleteButton` / `link-hit`: 连接线 hover 和删除热区。

---

## 文件结构

- Modify: `web/src/App.tsx`
  - 保留业务状态和 API 调用，但把 studio shell 拆成更接近案例的组件。
- Modify: `web/styles.css`
  - 删除或覆盖当前粗糙的展开侧栏样式，按案例 80px -> 220px hover 形态重写。
- Modify: `web/src/canvas/TshuabuNodeShapeUtil.tsx`
  - 节点只负责卡片内容和端口 DOM，不再直接 dispatch 粗糙连线逻辑。
- Create: `web/src/canvas/linkOverlay.ts`
  - 负责坐标、path、连接命中、菜单状态的纯函数。
- Create: `web/src/canvas/CanvasLinkOverlay.tsx`
  - DOM/SVG overlay：渲染临时线、已有线、删除按钮、命令菜单。
- Modify: `web/src/canvas/shapeUtils.ts`
  - 保留 snapshot 读写能力，但新增自己的 `canvasConnections` 转换，不把用户拖线直接等同 tldraw arrow。
- Create/Modify tests:
  - `web/src/canvas/linkOverlay.test.ts`
  - `web/src/canvas/shapeUtils.test.ts`

---

## Task 1: 侧栏按案例外壳重做

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 固定侧栏信息架构**

侧栏只保留我们当前能落地的入口：

```ts
const navItems = [
  { key: "assets", label: "本地素材", icon: Image },
  { key: "nodes", label: "节点工具", icon: Zap },
  { key: "settings", label: "API 设置", icon: Globe2 },
  { key: "history", label: "运行记录", icon: MessageSquare },
  { key: "canvas", label: "无限画布", icon: Grid3X3 }
];
```

不再展示“文生图、细节增强、图片编辑、角度控制、在线生图、GPT 对话”这些独立产品页入口，除非对应页面已经真实存在。

- [ ] **Step 2: 恢复案例的收缩侧栏**

`web/styles.css` 中 `.studio-sidebar` 必须匹配案例行为：

```css
.studio-sidebar {
  width: 80px;
  min-width: 80px;
  align-items: center;
  padding: 40px 0;
  transition: width 0.5s cubic-bezier(.4,0,.2,1) 0.5s;
}

.studio-sidebar:hover {
  width: 220px;
  transition-delay: 0s;
}

.studio-nav-item {
  width: 48px;
  height: 48px;
  overflow: hidden;
  justify-content: flex-start;
  padding-left: 14px;
}

.studio-sidebar:hover .studio-nav-item {
  width: 190px;
}

.studio-nav-item span {
  opacity: 0;
  margin-left: 16px;
}

.studio-sidebar:hover .studio-nav-item span {
  opacity: 1;
}
```

- [ ] **Step 3: 底部品牌和按钮照案例结构**

底部按钮默认是圆形图标，hover 展开 pill 文案：

```tsx
<div className="studio-side-actions">
  <button><Sun /><span>黑夜模式</span></button>
  <button><Languages /><span>中文</span></button>
  <button><Link /><span>API 设置</span></button>
  <button><Workflow /><span>ComfyUI 设置</span></button>
</div>
<div className="studio-author">Side</div>
```

- [ ] **Step 4: 验证侧栏**

Run:

```powershell
npm.cmd run build
```

Expected: 构建通过。手动打开 `http://127.0.0.1:5173/`，侧栏默认 80px，hover 后展开，底部显示 `Side`。

---

## Task 2: 连线从 tldraw arrow 改为案例同款 SVG overlay

**Files:**
- Create: `web/src/canvas/linkOverlay.ts`
- Create: `web/src/canvas/linkOverlay.test.ts`
- Create: `web/src/canvas/CanvasLinkOverlay.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/canvas/TshuabuNodeShapeUtil.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 写连线路径测试**

Create `web/src/canvas/linkOverlay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cubicPath, linkCreateOptions } from "./linkOverlay";

describe("linkOverlay", () => {
  it("creates the same cubic path shape as the reference canvas", () => {
    expect(cubicPath({ x: 10, y: 20 }, { x: 210, y: 80 })).toBe("M 10 20 C 100 20, 120 80, 210 80");
  });

  it("offers generator commands from image and prompt nodes", () => {
    expect(linkCreateOptions("prompt").map((item) => item.type)).toEqual([
      "api_text2img",
      "api_img2img",
      "api_inpaint",
      "video",
      "output"
    ]);
  });
});
```

- [ ] **Step 2: 实现纯函数**

Create `web/src/canvas/linkOverlay.ts`:

```ts
import type { CanvasNodeKind } from "./flowTypes";

export type Point = { x: number; y: number };

export type LinkCommandOption = {
  type: CanvasNodeKind;
  label: string;
};

export function cubicPath(a: Point, b: Point): string {
  const dx = Math.max(80, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function linkCreateOptions(nodeType: CanvasNodeKind): LinkCommandOption[] {
  if (nodeType === "api_text2img" || nodeType === "api_img2img" || nodeType === "api_inpaint" || nodeType === "video") {
    return [{ type: "output", label: "Output" }];
  }
  return [
    { type: "api_text2img", label: "文生图" },
    { type: "api_img2img", label: "图生图" },
    { type: "api_inpaint", label: "局部重绘" },
    { type: "video", label: "视频生成" },
    { type: "output", label: "Output" }
  ];
}
```

- [ ] **Step 3: 节点端口只发出 drag start**

`TshuabuNodeShapeUtil.tsx` 中端口使用案例热区尺寸：

```tsx
<button
  className="tshuabu-node-port out"
  type="button"
  onPointerDown={(event) => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent("tshuabu:link-drag-start", {
      detail: { shapeId: shape.id, nodeType: meta.nodeType, clientX: event.clientX, clientY: event.clientY }
    }));
  }}
/>
```

- [ ] **Step 4: 新建 SVG overlay 组件**

`CanvasLinkOverlay.tsx` 负责：

- 渲染已有连接线为 SVG path。
- 渲染拖拽中的临时线。
- 松手空白处弹出命令菜单。
- 选择命令后创建新节点，并把连接写入本地连接状态。

组件 props：

```ts
type CanvasLinkOverlayProps = {
  editor: Editor | null;
  connections: CanvasConnection[];
  onConnectionsChange: (connections: CanvasConnection[]) => void;
  onCreateLinkedNode: (originId: string, type: CanvasNodeKind, point: { x: number; y: number }) => string | undefined;
};
```

- [ ] **Step 5: 不再用 tldraw arrow 作为拖线结果**

`App.tsx` 中删除当前 `connectNodes(editor, ...)` 的直接 arrow 创建路径，改为：

```ts
setCanvasConnections((items) => [...items, { id: crypto.randomUUID(), from: originId, to: nextId }]);
```

后端 snapshot 需要边时，再把 `canvasConnections` 编译成 `edges`。

- [ ] **Step 6: 连线样式照案例**

```css
.canvas-link-layer {
  position: absolute;
  inset: 0;
  z-index: 35;
  pointer-events: none;
}

.canvas-link {
  fill: none;
  stroke: #94a3b8;
  stroke-width: 2.5;
  opacity: 0.82;
}

.canvas-link-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 18;
  pointer-events: stroke;
}

.tshuabu-node-port {
  position: absolute;
  top: 50%;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  transform: translateY(-50%);
  cursor: crosshair;
}

.tshuabu-node-port.out {
  right: -15px;
}

.tshuabu-node-port::after {
  content: "";
  position: absolute;
  left: 15px;
  top: 15px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: #111827;
  box-shadow: 0 0 0 1px #94a3b8;
}
```

- [ ] **Step 7: 验证**

Run:

```powershell
npm.cmd test -- web/src/canvas/linkOverlay.test.ts web/src/canvas/flowCompiler.test.ts
npm.cmd run build
```

Expected: 测试通过，构建通过。手动验证：从节点右侧端口拖出时线条为案例同款曲线；松手出现命令窗；选择命令后新节点和连接线出现。

---

## Task 3: 画布入口和白/黑模式统一

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 默认只启用黑夜模式**

第一阶段不要混白天/黑夜模式。所有 studio/canvas/shell/root 背景统一为 dark token：

```css
.studio-app-shell {
  --page: #0b1020;
  --grid: rgba(148,163,184,.16);
  --panel: rgba(17,24,39,.9);
  --card-solid: #111827;
  --text: #f8fafc;
  --muted: #cbd5e1;
}
```

- [ ] **Step 2: 保留按钮，不实现主题切换**

`黑夜模式` 按钮目前只是显示当前状态，不切换白天模式。避免“一半黑一半白”。

- [ ] **Step 3: 验证**

打开 `http://127.0.0.1:5173/`，进入画布后背景仍为黑夜模式，不能出现白色 tldraw 背景。

---

## Task 4: 对比页改为验收清单，不再画错误示意

**Files:**
- Modify: `web/ui-comparison.html`

- [ ] **Step 1: 对比页只展示真实目标**

删除“旧方向问题”那种示意，改成清单：

- 侧栏 80px 默认态。
- hover 展开 220px。
- 底部 `Side`。
- 选择画布门页。
- 节点端口 44px 热区。
- SVG 曲线连接。
- 拖线松手命令菜单。

- [ ] **Step 2: 加验收说明**

页面顶部写清楚：正式实现必须对齐 `references/Infinite-Canvas/static/index.html` 和 `canvas.html`，不是再自由发挥。

---

## 最终验证

- [ ] Run:

```powershell
npm.cmd test -- --run
npm.cmd run build
```

Expected: 全部测试通过，构建通过，允许 Vite chunk warning。

- [ ] Manual:

1. 打开 `http://127.0.0.1:5173/`。
2. 确认默认首屏是暗色 studio 外壳。
3. hover 左侧栏，确认它从 80px 展开到 220px。
4. 确认底部品牌为 `Side`。
5. 打开画布。
6. 从节点右侧端口拖出。
7. 确认显示案例同款曲线和命令菜单。
8. 点击命令创建子节点，确认连接线保留且可继续编辑。

---

## 自检

- 覆盖了用户反馈的四个问题：白底、DX/Side、侧栏功能混乱、无限画布连线和命令菜单。
- 明确放弃“自己设计一套相似 UI”，改为照案例结构复刻。
- 明确连线不能再用 tldraw arrow 拼凑，要做 DOM/SVG overlay。
- 没有要求实现案例里暂时不属于第一阶段的独立页面能力。
