# Full Reference Frontend Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完全复刻 `references/Infinite-Canvas` 的前端结构和交互，把我们现有业务内核接到复刻后的 UI 中。

**Architecture:** 以案例为主，不再以当前 React UI 为主。先复刻 studio shell、canvas gate、canvas board、节点和连线系统，再接现有 API、上传、保存、运行和日志能力。tldraw 只能作为临时承载或逐步剥离对象，不能决定 UI 形态。

**Tech Stack:** React, TypeScript, Vite, DOM/SVG canvas overlay, lucide-react, existing backend API, Vitest.

---

## 前置阅读

实施前必须阅读：

- `docs/frontend-reports/2026-05-21-infinite-canvas-reference-frontend-report.md`
- `D:/Tskanban/references/Infinite-Canvas/static/index.html`
- `D:/Tskanban/references/Infinite-Canvas/static/canvas.html`
- `D:/Tskanban/references/Infinite-Canvas/static/theme.css`

## 核心决策

1. 侧栏上方导航照案例，不再放“本地素材 / 节点工具 / API 设置 / 运行记录”。
2. API 设置和 ComfyUI 设置只出现在底部 side pill。
3. 本地素材归属无限画布内部的图片节点/拖拽上传，不作为 studio 一级入口。
4. 默认进入无限画布。
5. 左下品牌统一为 `Side`。
6. 默认黑夜模式，暂不实现白天切换。
7. 连线系统复刻案例 DOM/SVG，不再用 tldraw arrow 拼主要交互。

---

## Task 1: 重建 Studio Shell

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 定义案例同款页面入口**

在 `App.tsx` 中定义：

```ts
type StudioPageId =
  | "zimage"
  | "enhance"
  | "klein"
  | "angle"
  | "online"
  | "gpt-chat"
  | "canvas"
  | "api-settings"
  | "comfyui-settings";

const studioNavItems = [
  { id: "zimage", label: "文生图", icon: Image },
  { id: "enhance", label: "细节增强", icon: Zap },
  { id: "klein", label: "图片编辑", icon: Edit3 },
  { id: "angle", label: "角度控制", icon: Box },
  { id: "online", label: "在线生图", icon: Globe2 },
  { id: "gpt-chat", label: "GPT 对话", icon: MessageSquare },
  { id: "canvas", label: "无限画布", icon: Grid3X3 }
] satisfies Array<{ id: StudioPageId; label: string; icon: LucideIcon }>;
```

Expected: 不出现 `本地素材`、`节点工具`、`API 设置`、`运行记录` 作为上方入口。

- [ ] **Step 2: 重写 shell JSX**

结构必须接近案例：

```tsx
<main className="studio-app-shell theme-dark">
  <aside className="studio-sidebar">
    <StudioLogo />
    <StudioNav activePage={activePage} onSwitch={setActivePage} />
    <StudioSideActions onSwitch={setActivePage} />
    <StudioBrand />
  </aside>
  <section className="studio-stage">
    <StudioPage activePage={activePage} />
    <NanoMonitor queue={queueCount} />
  </section>
</main>
```

- [ ] **Step 3: 复刻 sidebar CSS**

按案例值：

```css
.studio-sidebar {
  width: 80px;
  min-width: 80px;
  padding: 40px 0;
  align-items: center;
  transition: width 0.5s var(--fluid-ease) 0.5s;
}

.studio-sidebar:hover {
  width: 220px;
  transition-delay: 0s;
}
```

并复刻 `.nav-item`、`.nav-text`、`.side-pill`、`.author-box` 的 hover 展开。

- [ ] **Step 4: 底部设置区**

底部只保留：

```tsx
<button className="side-pill" onClick={() => setTheme("dark")}>黑夜模式</button>
<button className="side-pill">中文</button>
<button className="side-pill" onClick={() => setActivePage("api-settings")}>API 设置</button>
<button className="side-pill" onClick={() => setActivePage("comfyui-settings")}>ComfyUI 设置</button>
```

- [ ] **Step 5: 构建验证**

Run:

```powershell
npm.cmd run build
```

Expected: PASS。

---

## Task 2: 建立页面占位和默认无限画布

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 默认 active page 为 canvas**

```ts
const [activePage, setActivePage] = useState<StudioPageId>("canvas");
```

- [ ] **Step 2: 非 canvas 页面先做案例式占位**

未接业务的页面不要乱跳抽屉：

```tsx
function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="studio-placeholder-page">
      <h1>{title}</h1>
      <p>前端结构已保留，业务能力后续接入。</p>
    </section>
  );
}
```

- [ ] **Step 3: API / ComfyUI 页面只从底部进入**

这两个页面可以复用现有面板组件，但必须作为 stage page 渲染，不是 sidebar 上方入口。

- [ ] **Step 4: 验证**

手动验证：

1. 默认进入无限画布。
2. 点击 API 设置只从底部按钮触发。
3. 上方没有 API 设置、本地素材入口。

---

## Task 3: 复刻 Canvas Gate

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 拆出 `CanvasStudioPage`**

```tsx
function CanvasStudioPage(props: CanvasStudioPageProps) {
  return (
    <div className={`canvas-shell ${props.canvasOpen ? "" : "no-canvas"} theme-dark`}>
      {!props.canvasOpen ? <CanvasGate /> : <CanvasBoard />}
    </div>
  );
}
```

- [ ] **Step 2: 复刻 gate DOM**

必须包含：

- `canvas-gate`
- `gate-panel`
- `gate-head`
- `gate-title-row`
- `gate-count-pill`
- `gate-head-actions`
- `gate-list`

- [ ] **Step 3: gate 行为**

按钮：

- 刷新列表
- 打开回收站
- 新建画布
- 确认/取消新建

第一阶段可以使用 localStorage 存画布列表，但 DOM 和状态必须按案例。

- [ ] **Step 4: 验证**

Run:

```powershell
npm.cmd run build
```

Expected: PASS。手动验证：进入无限画布先看到选择画布面板。

---

## Task 4: 复刻 Canvas Board 层级

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/canvas/ReferenceCanvasBoard.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 建立 board DOM**

结构：

```tsx
<div id="board" className="board editor-only">
  <div id="dropOverlay" className="drop-overlay">拖放图片到画布</div>
  <div id="selectionBox" className="selection-box" />
  <div id="selectionHub" className="selection-hub" />
  <CreateMenus />
  <div id="world" className="world">
    <svg id="links" className="links" />
    <div id="linkControls" className="link-controls" />
    <div id="nodes" />
  </div>
</div>
```

- [ ] **Step 2: 顶部 toolbar**

进入画布后显示案例 toolbar：

- 图片
- 提示词
- 循环
- LLM
- API生成
- MS生成
- 视频生成
- ComfyUI
- Output
- 分组
- 日志

不可用能力禁用，但按钮位置保留。

- [ ] **Step 3: 验证**

手动验证：没有左/右大抽屉压住画布，工具在顶部 toolbar。

---

## Task 5: 复刻节点 DOM 卡片

**Files:**
- Create: `web/src/canvas/referenceNodes.ts`
- Create: `web/src/canvas/ReferenceNode.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 定义节点类型**

```ts
export type ReferenceNodeType =
  | "image"
  | "prompt"
  | "loop"
  | "llm"
  | "generator"
  | "msgen"
  | "video"
  | "comfy"
  | "output";
```

- [ ] **Step 2: 节点 DOM 必须包含端口**

```tsx
<div className={`node ${node.type}-node`} data-id={node.id}>
  <button className="port in" />
  <div className="node-head">...</div>
  <div className="node-body">...</div>
  <button className="port out" />
  <button className="resize-handle" />
</div>
```

- [ ] **Step 3: 复刻节点样式**

照案例 `.node`、`.node-head`、`.node-body`、`.port`、`.resize-handle`。

- [ ] **Step 4: 验证**

Run:

```powershell
npm.cmd run build
```

Expected: PASS。

---

## Task 6: 复刻 SVG 连线系统

**Files:**
- Create: `web/src/canvas/referenceLinks.ts`
- Create: `web/src/canvas/referenceLinks.test.ts`
- Modify: `web/src/canvas/ReferenceCanvasBoard.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 写 path 测试**

```ts
import { describe, expect, it } from "vitest";
import { pathForLink } from "./referenceLinks";

describe("referenceLinks", () => {
  it("uses the same cubic curve formula as the reference", () => {
    expect(pathForLink({ x: 0, y: 10 }, { x: 200, y: 50 })).toBe("M 0 10 C 90 10, 110 50, 200 50");
  });
});
```

- [ ] **Step 2: 实现连接数据**

```ts
export type ReferenceConnection = {
  id: string;
  from: string;
  to: string;
};
```

- [ ] **Step 3: 实现拖线**

复刻案例逻辑：

- pointer down port -> `tempLink`
- pointer move -> 更新临时线
- pointer up target port -> 写入 connection
- pointer up 空白 -> open link create menu

- [ ] **Step 4: 实现命令菜单**

菜单类型：

- 从 image/prompt/loop/group/llm 输出：API生成、MS生成、ComfyUI、视频生成、LLM。
- 从 generator/video/comfy 输出：Output。

未实现能力 disabled，但视觉位置保留。

- [ ] **Step 5: 验证**

Run:

```powershell
npm.cmd test -- web/src/canvas/referenceLinks.test.ts
npm.cmd run build
```

Expected: PASS。

---

## Task 7: 接入现有业务内核

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/api/client.ts`
- Modify: `web/src/canvas/flowCompiler.ts`

- [ ] **Step 1: 图片节点接上传**

图片节点点击/拖拽调用现有 `uploadImage`。

- [ ] **Step 2: prompt / generator / output 编译成现有 flow**

把 `ReferenceNode[]` 和 `ReferenceConnection[]` 转成当前后端需要的 `CanvasSnapshot`。

- [ ] **Step 3: 运行结果写回 output**

执行后把输出资源写入 output 节点，不改变视觉结构。

- [ ] **Step 4: 验证**

Run:

```powershell
npm.cmd test -- --run
npm.cmd run build
```

Expected: PASS。

---

## Task 8: 对比页改为复刻验收报告页

**Files:**
- Modify: `web/ui-comparison.html`

- [ ] **Step 1: 删除自造对比示意**

对比页不再放“我们当前实现”的手绘示意。

- [ ] **Step 2: 改成验收清单**

列出：

- sidebar 默认 80px。
- hover 展开 220px。
- 上方导航按案例。
- 底部 API/ComfyUI。
- Side 品牌。
- canvas gate。
- board/world/links/nodes。
- port drag link。
- link create menu。

---

## 最终验收

- [ ] `npm.cmd test -- --run` PASS。
- [ ] `npm.cmd run build` PASS。
- [ ] 首屏看起来就是案例 studio shell。
- [ ] 左侧没有本地素材/API 顶部入口。
- [ ] API 只在底部设置区。
- [ ] 无限画布内才处理图片素材和节点。
- [ ] 连线交互不是 tldraw arrow，而是案例同款 SVG 连接层。

---

## 暂停点

这份计划完成后先不要继续实现，等用户确认报告和计划方向。确认后再开工。

## 2026-05-21 用户确认后的修正

用户已确认不要小修小改，按完整案例前端复刻方向开工。同时补充要求：

1. 左侧案例里的 `文生图`、`细节增强`、`图片编辑`、`角度控制`、`GPT 对话` 都可以保留并做成可用页面。
2. 这些页面全部调用我们自己的 API 能力，不依赖 ComfyUI。
3. `ComfyUI 设置` 不作为第一阶段业务入口。为了避免误导，实施时应从底部设置区移除，或保留为 disabled 状态并标注“暂不使用”。推荐移除。
4. `API 设置` 仍然只放在底部设置区，不放在左侧上方导航。
5. `本地素材` 不作为左侧一级入口，只属于无限画布内部的图片节点、拖拽上传和粘贴上传能力。

因此 Task 1 的底部设置区修正为：

```tsx
<button className="side-pill" onClick={() => setTheme("dark")}>黑夜模式</button>
<button className="side-pill">中文</button>
<button className="side-pill" onClick={() => setActivePage("api-settings")}>API 设置</button>
```

左侧上方导航保留：

```ts
const studioNavItems = [
  { id: "zimage", label: "文生图", icon: Image },
  { id: "enhance", label: "细节增强", icon: Zap },
  { id: "klein", label: "图片编辑", icon: Edit3 },
  { id: "angle", label: "角度控制", icon: Box },
  { id: "online", label: "在线生图", icon: Globe2 },
  { id: "gpt-chat", label: "GPT 对话", icon: MessageSquare },
  { id: "canvas", label: "无限画布", icon: Grid3X3 }
];
```

新增实施原则：先复刻页面和布局，再把每个页面接到 API。没有接好的页面可以显示案例式空状态，但不能伪装成已完成。
