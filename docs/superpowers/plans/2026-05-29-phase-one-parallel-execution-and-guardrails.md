# 第一阶段样例级复刻并行开发与防跑偏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第一阶段剩余工作拆成可并行、可验收、可回滚的开发轨道，确保每个 subagent 只在自己的文件范围内工作，不干扰主进程和当前分支，并在用户临时指出问题时能按样例与 SPEC 重新校准，不跑偏。

**Architecture:** 主进程只负责产品判断、分支集成、视觉验收和最终提交；subagent 只负责隔离工作区内的单一任务。所有并行任务必须先产出测试或截图证据，再由主进程合并；任何跨文件大改必须先升级为“集成任务”，不能让多个 subagent 同时改同一个核心文件。

**Tech Stack:** React、TypeScript、Vite、Express、Vitest、Playwright、Git worktree、当前 `codex/gene-library` 分支、样例项目 `D:/Tskanban/references/Infinite-Canvas`。

---

## 1. 计划定位

这份计划不是重新定义产品，而是给接下来的开发建立“执行纪律”：

- 旧计划 `2026-05-28-phase-one-sample-parity-closure.md` 负责回答“要做什么”。
- 本计划负责回答“怎么并行做、怎么不互相干扰、怎么防止我改着改着偏离样例”。

当前产品边界保持不变：

- 不做 ModelScope / MS 生成，右上 `MS生成` 必须替换为 `基因库`。
- 暂时不做 ComfyUI 真实执行。
- 必须对齐样例的 UI 气质、画布交互、节点系统、连线系统、功能页面成熟度。
- 必须满足 `SPEC.md` 的 MVP 验收：导入、节点连线、text2img、inpaint、版本链、导出、RAG 结构化日志。

---

## 2. 并行开发总原则

### 2.1 主进程职责

主进程只能做这些事：

1. 读取样例、读取 SPEC、确认产品标准。
2. 创建或确认隔离 worktree。
3. 给 subagent 分配明确任务、明确文件边界、明确验收命令。
4. 审查 subagent 结果。
5. 处理文件冲突和最终集成。
6. 向用户汇报“这次做了什么”和“接下来要做什么”。

主进程不能把多个大任务同时直接写进当前分支，否则会再次出现 UI、功能、样例标准混在一起的问题。

### 2.2 Subagent 职责

每个 subagent 只能做一件事：

- 一个 subagent 一个目标。
- 一个 subagent 一个隔离 worktree。
- 一个 subagent 一个文件所有权范围。
- 一个 subagent 一组验收命令。
- 一个 subagent 结束时必须报告：
  - 改了哪些文件。
  - 没改哪些文件。
  - 跑了哪些测试。
  - 哪些风险留给主进程。

### 2.3 禁止规则

这些事情不允许 subagent 做：

1. 不能直接改主 worktree。
2. 不能直接 push。
3. 不能改自己任务范围外的文件。
4. 不能重写 `ReferenceCanvas.tsx` 全文件，除非任务明确是“画布集成任务”。
5. 不能把样例不需要的开源 UI 混进来。
6. 不能重新引入 `MS生成`、`魔塔`、`DX`、乱码中文。
7. 不能把 ComfyUI 做成当前主流程依赖。
8. 不能用英文写产品界面文案。

---

## 3. 分支与 Worktree 策略

当前主分支：

```text
codex/gene-library
```

主 worktree：

```text
D:/Tskanban/.worktrees/phase-one-visual-closure
```

建议为每条并行轨道创建独立 worktree：

```powershell
git worktree add D:/Tskanban/.worktrees/phase-one-ui-system -b codex/phase-one-ui-system codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-canvas-core -b codex/phase-one-canvas-core codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-image-api -b codex/phase-one-image-api codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-feature-pages -b codex/phase-one-feature-pages codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-history-logs -b codex/phase-one-history-logs codex/gene-library
```

如果某个 worktree 已存在，先检查状态：

```powershell
git -C D:/Tskanban/.worktrees/phase-one-ui-system status --short
git -C D:/Tskanban/.worktrees/phase-one-canvas-core status --short
git -C D:/Tskanban/.worktrees/phase-one-image-api status --short
git -C D:/Tskanban/.worktrees/phase-one-feature-pages status --short
git -C D:/Tskanban/.worktrees/phase-one-history-logs status --short
```

只有对应 worktree 干净时，才允许分配新任务。

---

## 4. 并行轨道拆分

### 轨道 A：样例级 UI 系统

**目标：** 统一全局产品壳、左侧栏、底部按钮、弹窗、按钮、tooltip、颜色、字号、圆角、hover、选中态。

**独占文件：**

```text
web/src/ui/ProductShell.tsx
web/src/ui/ReferenceButton.tsx
web/src/ui/ReferenceModal.tsx
web/src/ui/Tooltip.tsx
web/src/styles.css
web/src/App.tsx
web/src/pages/__tests__/featurePages.test.tsx
```

**不能改：**

```text
src/imageApi.ts
src/routes/api.ts
src/services/canvases.ts
src/logger.ts
web/src/canvas/ReferenceCanvas.tsx
```

**验收：**

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm run build
rg "DX|MS生成|魔塔|鐢|鍙|杩" web/src -n
```

`rg` 预期：不能出现可见 UI 文案残留。

**常见问题与处理：**

| 问题 | 处理方式 |
|---|---|
| 左侧栏展开字号过大 | 只改 `ProductShell.tsx` 和 `styles.css` 中侧栏 token，不碰画布逻辑 |
| 收起后图标不居中 | 用固定 `width/height/display:grid/place-items:center` 修复 |
| 黑夜/中文/API 底部缩放不一致 | 抽成同一个 `ReferenceButton` variant |
| API 弹窗难看 | 先统一 `ReferenceModal`，不要直接在业务组件里乱加样式 |

---

### 轨道 B：画布交互核心

**目标：** 对齐样例无限画布：拖拽移动、Ctrl 框选、Delete 删除、节点端口、拖线预览、命令菜单、断线、Shift 切线、节点 resize、图片拖入节点。

**独占文件：**

```text
web/src/canvas/canvasTypes.ts
web/src/canvas/canvasGraph.ts
web/src/canvas/nodeRegistry.tsx
web/src/canvas/nodeRenderers.tsx
web/src/canvas/edgeInteractions.ts
web/src/canvas/ReferenceCanvas.tsx
web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
tests/canvasGraph.test.ts
```

**可以少量改：**

```text
web/src/styles.css
```

改 CSS 时必须只加 `.canvas-*`、`.node-*`、`.edge-*` 范围的样式，不能改全局壳。

**不能改：**

```text
src/imageApi.ts
src/services/providers.ts
src/logger.ts
web/src/pages/*
```

**验收：**

```powershell
npm test -- tests/canvasGraph.test.ts web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
npm run build
```

浏览器手工验收：

```text
空白画布拖拽能移动。
Ctrl 框选能选中多个节点。
Delete 能删除选中节点。
从端口拖线有预览线。
拖到空白处出现命令菜单。
拖到兼容端口建立连线。
已有连线能断开。
Shift 拖过连线能切断。
图片节点点击能导入。
图片拖到图片节点内部能导入。
节点缩放控制在节点内部，不出现外部调试框。
```

**常见问题与处理：**

| 问题 | 处理方式 |
|---|---|
| 修连线导致画布不能移动 | 先写 `pointer capture` 事件测试，区分 `canvas pan` 和 `port drag` 状态 |
| Ctrl 框选失效 | 检查全局 key state，不要被输入框吞掉；输入框聚焦时不触发框选 |
| Delete 不生效 | 检查焦点是否在 textarea/input；在输入框内 Delete 只删文字 |
| 连线命令菜单不出现 | 在 release 空白区域时用画布坐标放置菜单，不用屏幕坐标直接写节点 |
| 节点滚轮难看 | 节点内部隐藏 scrollbar，但内容区域仍可滚动 |

---

### 轨道 C：图像 API 真实性与图片编辑

**目标：** 证明 text2img、img2img、inpaint 是三条不同的真实 API 路径；图片参考图不会被丢；画布内能做遮罩/局部重绘。

**独占文件：**

```text
src/imageApi.ts
src/flows/runners/api.ts
tests/imageApi.test.ts
web/src/canvas/imageEdit.ts
```

**需要和轨道 B 集成时才改：**

```text
web/src/canvas/ReferenceCanvas.tsx
web/src/canvas/nodeRenderers.tsx
```

如果要改这两个文件，必须等轨道 B 完成第一轮合并后，由主进程执行集成。

**验收：**

```powershell
npm test -- tests/imageApi.test.ts
npm run build
```

必须新增或确认这些测试：

```text
text2img 请求不带 reference images。
img2img 请求必须带 reference image。
inpaint 请求必须带 source image 和 mask。
输出记录 provider/model/mode/inputAssetIds/outputAssetIds/latency。
```

**常见问题与处理：**

| 问题 | 处理方式 |
|---|---|
| 生成不按样图来 | 先看测试和实际 payload，确认 reference image 是否进入请求体 |
| 供应商字段不一致 | 在 `imageApi.ts` 做内部统一协议，再映射供应商字段 |
| inpaint 结果偏移 | 记录画布坐标、图片自然尺寸、显示尺寸，统一坐标换算 |
| 只做了图转文再文生图 | 测试直接失败；img2img 必须有图片字段 |

---

### 轨道 D：功能页面成熟化

**目标：** 文生图、细节增强、图片编辑、角度控制、在线生图、GPT 对话不再是空壳，每个页面都要有样例级参数区、预览区、管理区。

**独占文件：**

```text
web/src/pages/TextToImagePage.tsx
web/src/pages/EnhancePage.tsx
web/src/pages/ImageEditPage.tsx
web/src/pages/AngleControlPage.tsx
web/src/pages/OnlineImagePage.tsx
web/src/pages/GptChatPage.tsx
web/src/pages/__tests__/featurePages.test.tsx
```

**可以少量改：**

```text
web/src/styles.css
```

CSS 必须使用轨道 A 的 UI token，不能自建一套视觉。

**不能改：**

```text
web/src/canvas/ReferenceCanvas.tsx
src/imageApi.ts
src/routes/api.ts
```

**验收：**

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm run build
```

页面验收：

```text
文生图：尺寸、批量、版本管理、提示词模板、预览。
细节增强：输入图、增强程度、预览、管理。
图片编辑：输入图、提示词、参考、遮罩入口、预览、管理。
角度控制：输入图片、相机控制、参数、结果。
在线生图：供应商/模型、提示词、尺寸、预览、历史。
GPT 对话：对话、图片附件、提示词优化、历史。
```

**常见问题与处理：**

| 问题 | 处理方式 |
|---|---|
| 页面又像原型 | 直接回看样例页面结构，按三栏：参数、预览、管理 |
| 重复提示词窗口 | 页面可以有提示词，但画布节点里若已有提示词输入，生成节点不能再做一堆覆盖字段 |
| 与画布功能重复 | 页面负责单任务快捷工作流，画布负责节点编排 |

---

### 轨道 E：历史、日志、保存与版本链

**目标：** 看板/画布内容不会丢；历史可查；失败可追；RAG 日志字段稳定。

**独占文件：**

```text
src/services/canvases.ts
src/services/sessions.ts
src/logger.ts
src/routes/api.ts
tests/canvasPersistence.test.ts
tests/workflowExecutor.test.ts
```

**需要和画布集成时才改：**

```text
web/src/canvas/canvasPersistence.ts
web/src/canvas/ReferenceCanvas.tsx
```

**验收：**

```powershell
npm test -- tests/canvasPersistence.test.ts tests/workflowExecutor.test.ts
npm run build
```

必须满足：

```text
保存状态可见。
刷新后内容恢复。
删除不是直接永久删除。
可恢复删除画布。
每次执行记录节点输入、输出、耗时、失败、重试次数。
失败事件也写入日志。
API 错误最多重试 3 次。
参数错误、缺输入、鉴权错误不自动重试。
```

**常见问题与处理：**

| 问题 | 处理方式 |
|---|---|
| 用户写的看板第二天没了 | 优先检查 autosave 触发、服务端写盘、localStorage 草稿兜底 |
| 日志只有调试信息 | 必须按 RAG 资产记录：流程结构、输入、输出、耗时、坐标 |
| 重试乱重试 | 按错误分类，不按耗时重试 |

---

### 轨道 F：基因库产品化

**目标：** 基因库彻底替代 MS 生成，支持提示词基因和流程基因，能重命名、删除、三列展示、点击生成节点或恢复工作流。

**独占文件：**

```text
web/src/canvas/geneLibrary.ts
web/src/canvas/nodeRenderers.tsx
web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
```

**需要和轨道 B 集成时才改：**

```text
web/src/canvas/ReferenceCanvas.tsx
```

**验收：**

```powershell
npm test -- web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
npm run build
rg "MS生成|魔塔" web/src -n
```

预期：`rg` 不出现可见产品文案。

必须满足：

```text
右上按钮显示“基因库”。
基因按钮一排三个。
添加基因可保存提示词节点。
添加基因可保存多个选中节点和连线。
点击提示词基因，在桌面生成提示词节点。
点击流程基因，恢复整套节点和连线。
每个基因可以重命名和删除。
```

---

## 5. 哪些任务可以并行

第一轮可以并行：

| 并行组 | 轨道 | 原因 |
|---|---|---|
| 第一组 | A UI 系统 | 主要改产品壳和公共 UI |
| 第一组 | C 图像 API | 主要改后端/服务层，不碰 UI 壳 |
| 第一组 | E 历史日志 | 主要改服务和日志，不碰 UI 壳 |

第二轮可以并行：

| 并行组 | 轨道 | 前置条件 |
|---|---|---|
| 第二组 | B 画布交互 | A 的 UI token 已稳定 |
| 第二组 | D 功能页面 | A 的 UI token 已稳定 |
| 第二组 | F 基因库 | B 的 node renderer 拆分完成 |

不能并行的组合：

| 组合 | 原因 |
|---|---|
| A 和 B 同时大改 `styles.css` | 容易覆盖视觉系统 |
| B 和 F 同时改 `nodeRenderers.tsx` | 节点渲染冲突高 |
| B 和 C 同时改 `ReferenceCanvas.tsx` | 画布集成冲突高 |
| D 和 A 同时重构 `App.tsx` | 路由和壳层冲突高 |
| E 和 B 同时改 canvas persistence | 保存状态与画布状态耦合 |

---

## 6. Subagent 派发模板

每次派发 subagent 时，主进程必须使用下面格式。不能只说“去修 UI”。

```text
你是本任务的独立 subagent。你不在主分支上工作，你只在自己的隔离 worktree 中修改文件。

任务名称：
[写清楚任务]

产品标准：
1. 所有回复和可见 UI 文案用中文。
2. 以 D:/Tskanban/references/Infinite-Canvas 为视觉和交互样例。
3. 遵守 SPEC.md 的 MVP 验收。
4. 不引入 ModelScope/MS，不引入 ComfyUI 主流程依赖。

允许修改文件：
[列出精确文件路径]

禁止修改文件：
[列出精确文件路径]

必须先做：
1. 阅读相关样例文件。
2. 阅读当前实现文件。
3. 写测试或截图验收说明。

验收命令：
[列出 npm test / npm run build / rg 命令]

完成后必须汇报：
1. 修改文件列表。
2. 未修改但发现有风险的文件。
3. 测试结果。
4. 剩余风险。

如果你发现必须修改禁止文件，立即停止并汇报，不要绕过边界。
```

---

## 7. 用户临时指出问题时的防跑偏流程

当用户中途说“这里又错了”“不是这个样子”“样例不是这么做的”，主进程必须执行下面流程。

### Step 1：冻结当前改动

先看状态：

```powershell
git status --short
```

如果当前任务有未提交改动，不继续扩大修改范围。

### Step 2：把问题分类

只允许分成五类：

```text
UI 偏差：视觉、字号、位置、颜色、弹窗、按钮。
交互偏差：拖拽、连线、断线、菜单、选择、删除。
功能偏差：API、保存、生成、循环、LLM、图片编辑。
数据偏差：日志、历史、版本、RAG、持久化。
产品边界偏差：MS、ComfyUI、重复入口、不该出现的功能。
```

### Step 3：回看样例证据

必须至少做一个动作：

```powershell
rg "相关关键词" D:/Tskanban/references/Infinite-Canvas/static -n
rg "相关关键词" D:/Tskanban/references/Infinite-Canvas -n
```

如果是 UI 问题，必须截图或打开浏览器对比。

### Step 4：写一句修正目标

格式：

```text
这次只修：[具体问题]。
验收标准：[用户能看到/能操作的结果]。
不顺手修：[列出暂不动的范围]。
```

### Step 5：决定由谁改

| 情况 | 处理 |
|---|---|
| 属于当前 subagent 文件范围 | 让当前 subagent 修 |
| 超出当前 subagent 文件范围 | 暂停 subagent，主进程开新的修正任务 |
| 影响两个轨道 | 主进程做集成修正 |
| 用户否定产品方向 | 先改计划，不直接改代码 |

### Step 6：修完必须证明没有跑偏

至少跑：

```powershell
npm run build
```

如果是该轨道测试覆盖范围，还要跑对应测试。

如果是 UI 问题，要给浏览器截图或明确说明已在浏览器验证。

---

## 8. 防止“越改越不像样例”的验收闸门

### 8.1 每次 UI 改动前的样例检查

开发者必须先确认样例在哪：

```text
样例入口：D:/Tskanban/references/Infinite-Canvas/static/index.html
样例画布：D:/Tskanban/references/Infinite-Canvas/static/canvas.html
样例主题：D:/Tskanban/references/Infinite-Canvas/static/theme.css
样例 i18n：D:/Tskanban/references/Infinite-Canvas/static/i18n.js
```

UI 修改不能只凭想象。必须回答：

```text
样例这里的结构是什么？
我们现在哪里不同？
这次修改要让哪一项更接近样例？
```

### 8.2 每次功能改动前的 SPEC 检查

功能修改必须回答：

```text
这个功能对应 SPEC 哪一条？
它是否服务于导入、节点连线、生成、局部重绘、版本、导出、RAG？
如果不是，为什么现在要做？
```

不能回答的功能，默认不做。

### 8.3 每次合并前的残留扫描

合并前必须跑：

```powershell
rg "DX|MS生成|魔塔|ModelScope|ComfyUI 设置|鐢|鍙|杩|乱码|placeholder|Lorem" web src docs -n
npm run build
```

命中结果必须逐项解释：

- 如果是文档里的历史记录，可以保留。
- 如果是可见 UI，必须修。
- 如果是测试 fixture，必须说明用途。

---

## 9. 开发顺序与并行安排

### 第 0 天：准备与冻结标准

- [ ] 主进程确认当前分支干净。

```powershell
git status --short
git branch --show-current
```

- [ ] 主进程确认样例目录存在。

```powershell
Test-Path D:/Tskanban/references/Infinite-Canvas/static/canvas.html
Test-Path D:/Tskanban/references/Infinite-Canvas/static/theme.css
```

- [ ] 主进程创建五个 worktree。

```powershell
git worktree add D:/Tskanban/.worktrees/phase-one-ui-system -b codex/phase-one-ui-system codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-canvas-core -b codex/phase-one-canvas-core codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-image-api -b codex/phase-one-image-api codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-feature-pages -b codex/phase-one-feature-pages codex/gene-library
git worktree add D:/Tskanban/.worktrees/phase-one-history-logs -b codex/phase-one-history-logs codex/gene-library
```

### 第 1 轮：低冲突并行

- [ ] Subagent A：UI 系统。
- [ ] Subagent C：图像 API 真实性。
- [ ] Subagent E：历史日志保存。

主进程同时做：

- [ ] 建立截图验收报告模板。
- [ ] 整理样例 UI 对比清单。
- [ ] 不改核心代码。

### 第 2 轮：画布与页面并行

前置条件：

```text
A 已完成 UI token。
C 已完成 img2img/inpaint payload 测试。
E 已完成保存和日志基础。
```

- [ ] Subagent B：画布交互核心。
- [ ] Subagent D：功能页面成熟化。

主进程负责：

- [ ] 把 A 的 UI token 合入 B 和 D。
- [ ] 解决 `styles.css` 冲突。
- [ ] 浏览器检查左侧栏、底部按钮、画布外框。

### 第 3 轮：高耦合集成

- [ ] 主进程集成 B + C：图片节点、img2img、inpaint、遮罩。
- [ ] 主进程集成 B + E：画布保存状态、恢复、版本链。
- [ ] Subagent F：基因库产品化。

这一轮不建议多个 subagent 同时改 `ReferenceCanvas.tsx`。

### 第 4 轮：最终验收

- [ ] Playwright 浏览器验收。
- [ ] 手动对照样例。
- [ ] 用户指出偏差后，只按防跑偏流程修。
- [ ] 通过后统一提交和推送。

---

## 10. 详细任务清单

### Task A1：统一产品壳和视觉 token

**Files:**
- Create: `web/src/ui/ProductShell.tsx`
- Create: `web/src/ui/ReferenceButton.tsx`
- Create: `web/src/ui/ReferenceModal.tsx`
- Create: `web/src/ui/Tooltip.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/pages/__tests__/featurePages.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

describe('产品壳', () => {
  it('显示样例侧栏和底部设置入口', () => {
    render(<App />);
    expect(screen.getByText('文生图')).toBeTruthy();
    expect(screen.getByText('细节增强')).toBeTruthy();
    expect(screen.getByText('图片编辑')).toBeTruthy();
    expect(screen.getByText('角度控制')).toBeTruthy();
    expect(screen.getByText('在线生图')).toBeTruthy();
    expect(screen.getByText('GPT 对话')).toBeTruthy();
    expect(screen.getByText('无限画布')).toBeTruthy();
    expect(screen.getByText('黑夜模式')).toBeTruthy();
    expect(screen.getByText('中文')).toBeTruthy();
    expect(screen.getByText('API 设置')).toBeTruthy();
    expect(screen.getByText('Side')).toBeTruthy();
  });
});
```

- [ ] **Step 2：运行测试确认失败**

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
```

- [ ] **Step 3：实现 UI 壳**

实现标准：

```text
左侧展开态宽度 326px。
收起态宽度 64px。
图标按钮在圆形中心。
底部按钮与上方导航使用同一缩放比例。
品牌只显示 Side。
可见文案全中文。
```

- [ ] **Step 4：运行验收**

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm run build
rg "DX|MS生成|魔塔|鐢|鍙|杩" web/src -n
```

- [ ] **Step 5：提交**

```powershell
git add web/src/ui web/src/App.tsx web/src/styles.css web/src/pages/__tests__/featurePages.test.tsx
git commit -m "feat: unify phase one product shell"
```

---

### Task B1：画布基础交互回归

**Files:**
- Create/Modify: `web/src/canvas/canvasTypes.ts`
- Create/Modify: `web/src/canvas/canvasGraph.ts`
- Create/Modify: `web/src/canvas/edgeInteractions.ts`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Test: `tests/canvasGraph.test.ts`

- [ ] **Step 1：写图结构测试**

```ts
import { describe, expect, it } from 'vitest';
import { disconnectEdge, isCanvasShortcutAllowed } from '../web/src/canvas/canvasGraph';

describe('画布图结构', () => {
  it('可以按 id 删除连线', () => {
    expect(disconnectEdge([{ id: 'e1', from: 'a', to: 'b' }], 'e1')).toEqual([]);
  });

  it('输入框聚焦时不触发画布 Delete 快捷键', () => {
    expect(isCanvasShortcutAllowed('TEXTAREA')).toBe(false);
    expect(isCanvasShortcutAllowed('INPUT')).toBe(false);
    expect(isCanvasShortcutAllowed('DIV')).toBe(true);
  });
});
```

- [ ] **Step 2：运行测试确认失败**

```powershell
npm test -- tests/canvasGraph.test.ts
```

- [ ] **Step 3：实现交互**

必须覆盖：

```text
画布拖拽移动。
Ctrl 框选。
Delete 删除节点。
端口拖线。
空白释放出现命令菜单。
hover 连线出现删除。
Shift 切线。
Escape 取消拖线。
```

- [ ] **Step 4：运行验收**

```powershell
npm test -- tests/canvasGraph.test.ts
npm run build
```

- [ ] **Step 5：提交**

```powershell
git add web/src/canvas tests/canvasGraph.test.ts
git commit -m "feat: harden canvas interactions"
```

---

### Task C1：图生图和局部重绘请求验真

**Files:**
- Modify: `src/imageApi.ts`
- Modify: `src/flows/runners/api.ts`
- Test: `tests/imageApi.test.ts`

- [ ] **Step 1：写 payload 测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildImageRequestPayload } from '../src/imageApi';

describe('图像 API 请求', () => {
  it('文生图不携带参考图', () => {
    const payload = buildImageRequestPayload({
      mode: 'text2img',
      prompt: '生成一张产品图',
      size: '1024x1024',
      inputImages: [],
    });
    expect(payload.prompt).toContain('产品图');
    expect(payload.images).toBeUndefined();
  });

  it('图生图必须携带参考图', () => {
    const payload = buildImageRequestPayload({
      mode: 'img2img',
      prompt: '保持构图，改变风格',
      size: '1024x1024',
      inputImages: [{ mimeType: 'image/png', dataUrl: 'data:image/png;base64,IMG' }],
    });
    expect(JSON.stringify(payload)).toContain('data:image/png;base64,IMG');
  });

  it('局部重绘必须携带原图和遮罩', () => {
    const payload = buildImageRequestPayload({
      mode: 'inpaint',
      prompt: '替换局部背景',
      size: '1024x1024',
      inputImages: [{ mimeType: 'image/png', dataUrl: 'data:image/png;base64,SOURCE' }],
      mask: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,MASK' },
    });
    expect(JSON.stringify(payload)).toContain('SOURCE');
    expect(JSON.stringify(payload)).toContain('MASK');
  });
});
```

- [ ] **Step 2：运行测试确认当前真实状态**

```powershell
npm test -- tests/imageApi.test.ts
```

- [ ] **Step 3：实现或修正 payload 构造**

要求：

```text
text2img、img2img、inpaint 在内部协议上明确区分。
img2img 不允许退化为纯文生图。
inpaint 不允许没有 mask 就请求。
每次请求记录 mode、provider、model、inputAssetIds、outputAssetIds。
```

- [ ] **Step 4：运行验收**

```powershell
npm test -- tests/imageApi.test.ts
npm run build
```

- [ ] **Step 5：提交**

```powershell
git add src/imageApi.ts src/flows/runners/api.ts tests/imageApi.test.ts
git commit -m "fix: verify image reference api payloads"
```

---

### Task D1：功能页面补齐

**Files:**
- Modify: `web/src/pages/TextToImagePage.tsx`
- Modify: `web/src/pages/EnhancePage.tsx`
- Modify: `web/src/pages/ImageEditPage.tsx`
- Modify: `web/src/pages/AngleControlPage.tsx`
- Modify: `web/src/pages/OnlineImagePage.tsx`
- Modify: `web/src/pages/GptChatPage.tsx`
- Test: `web/src/pages/__tests__/featurePages.test.tsx`

- [ ] **Step 1：写页面测试**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextToImagePage } from '../TextToImagePage';
import { EnhancePage } from '../EnhancePage';
import { ImageEditPage } from '../ImageEditPage';
import { AngleControlPage } from '../AngleControlPage';

describe('功能页面', () => {
  it('文生图包含尺寸、批量和版本管理', () => {
    render(<TextToImagePage />);
    expect(screen.getByText('尺寸')).toBeTruthy();
    expect(screen.getByText('批量')).toBeTruthy();
    expect(screen.getByText('版本管理')).toBeTruthy();
  });

  it('细节增强包含增强程度、预览和管理', () => {
    render(<EnhancePage />);
    expect(screen.getByText('增强程度')).toBeTruthy();
    expect(screen.getByText('预览')).toBeTruthy();
    expect(screen.getByText('管理')).toBeTruthy();
  });

  it('图片编辑包含输入提示词、参考、预览和管理', () => {
    render(<ImageEditPage />);
    expect(screen.getByText('输入提示词')).toBeTruthy();
    expect(screen.getByText('参考')).toBeTruthy();
    expect(screen.getByText('预览')).toBeTruthy();
    expect(screen.getByText('管理')).toBeTruthy();
  });

  it('角度控制包含输入图片、相机控制、参数和结果', () => {
    render(<AngleControlPage />);
    expect(screen.getByText('输入图片')).toBeTruthy();
    expect(screen.getByText('相机控制')).toBeTruthy();
    expect(screen.getByText('参数')).toBeTruthy();
    expect(screen.getByText('结果')).toBeTruthy();
  });
});
```

- [ ] **Step 2：运行测试确认失败**

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
```

- [ ] **Step 3：实现页面**

页面结构：

```text
左侧参数区。
中间预览/工作区。
右侧管理/历史区。
无空白样子货。
无营销式大标题。
无英文产品文案。
```

- [ ] **Step 4：运行验收**

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm run build
```

- [ ] **Step 5：提交**

```powershell
git add web/src/pages web/src/pages/__tests__/featurePages.test.tsx
git commit -m "feat: complete phase one feature pages"
```

---

### Task E1：保存、历史和 RAG 日志

**Files:**
- Modify: `src/services/canvases.ts`
- Modify: `src/services/sessions.ts`
- Modify: `src/logger.ts`
- Modify: `src/routes/api.ts`
- Test: `tests/canvasPersistence.test.ts`
- Test: `tests/workflowExecutor.test.ts`

- [ ] **Step 1：写保存和日志测试**

```ts
import { describe, expect, it } from 'vitest';
import { classifyRetryableError, createNodeRunRecord } from '../src/logger';

describe('运行日志和重试', () => {
  it('API 网络错误可以重试', () => {
    expect(classifyRetryableError({ status: 502, message: 'bad gateway' })).toBe(true);
  });

  it('缺少输入不自动重试', () => {
    expect(classifyRetryableError({ status: 400, message: 'missing input image' })).toBe(false);
  });

  it('记录节点输入输出和耗时', () => {
    const record = createNodeRunRecord({
      flowId: 'flow-1',
      nodeId: 'api-1',
      mode: 'img2img',
      providerId: 'provider-1',
      model: 'image-model',
      latencyMs: 1200,
      inputAssetIds: ['input-1'],
      outputAssetIds: ['output-1'],
      status: 'success',
    });
    expect(record.inputAssetIds).toEqual(['input-1']);
    expect(record.outputAssetIds).toEqual(['output-1']);
    expect(record.latencyMs).toBe(1200);
  });
});
```

- [ ] **Step 2：运行测试确认失败**

```powershell
npm test -- tests/workflowExecutor.test.ts tests/canvasPersistence.test.ts
```

- [ ] **Step 3：实现保存和日志**

要求：

```text
画布保存有服务端版本。
画布删除保留 deletedAt，可恢复。
运行记录包含流程结构。
失败记录也写日志。
重试只针对 API 网络、5xx、限流。
RAG 日志包含局部框选坐标和局部提示词字段。
```

- [ ] **Step 4：运行验收**

```powershell
npm test -- tests/workflowExecutor.test.ts tests/canvasPersistence.test.ts
npm run build
```

- [ ] **Step 5：提交**

```powershell
git add src/services/canvases.ts src/services/sessions.ts src/logger.ts src/routes/api.ts tests/canvasPersistence.test.ts tests/workflowExecutor.test.ts
git commit -m "feat: harden canvas history and rag logs"
```

---

## 11. 集成策略

### 11.1 合并顺序

建议顺序：

```text
1. A UI 系统
2. E 保存日志
3. C 图像 API
4. B 画布交互
5. D 功能页面
6. F 基因库
7. 主进程最终集成
```

原因：

- UI token 先稳定，后续页面和画布才有统一视觉。
- 保存日志和 API 真实性先稳定，画布集成时不会继续猜接口。
- 画布是最高冲突区域，必须等基础接口清楚后再合。

### 11.2 每次合并前检查

```powershell
git status --short
npm test
npm run build
rg "DX|MS生成|魔塔|鐢|鍙|杩|placeholder|Lorem" web src docs -n
```

### 11.3 合并后浏览器检查

每合并一个 UI 轨道，必须检查：

```text
左侧栏展开/收起。
底部按钮。
API 设置弹窗。
画布选择窗口。
打开画布后的右上工具区。
节点、连线、菜单。
```

---

## 12. 风险矩阵

| 风险 | 可能后果 | 预防 |
|---|---|---|
| 多个任务同时改 `ReferenceCanvas.tsx` | 冲突大、行为回退 | 只有轨道 B 或主进程集成能改 |
| 多个任务同时改 `styles.css` | UI 又混乱 | A 定义 token，其他轨道只用 token |
| 图生图没有真实图片输入 | 生成不按样图 | C 轨道 payload 测试必须先过 |
| 保存逻辑只存在前端 | 第二天数据丢失 | E 轨道服务端保存 + 本地草稿双保险 |
| 用户临时指出 UI 错误后顺手大改 | 越修越偏 | 使用第 7 节防跑偏流程 |
| subagent 误改主分支 | 破坏主进程状态 | 每个 subagent 只在独立 worktree |
| 页面补齐变成空壳 | 看起来有入口但不可用 | D 轨道测试必须验证页面关键控件 |
| 基因库又残留 MS 文案 | 产品边界混乱 | F 轨道 `rg "MS生成|魔塔"` 必须无可见 UI 命中 |

---

## 13. 每日汇报格式

以后我向你汇报时固定使用这个格式：

```text
这次做了什么：
1. ...
2. ...

验证了什么：
1. ...
2. ...

发现的问题：
1. ...
2. ...

接下来要做什么：
1. ...
2. ...
```

如果有 subagent，也要额外报告：

```text
Subagent 状态：
- A UI 系统：进行中/完成/阻塞，改动范围...
- B 画布核心：进行中/完成/阻塞，改动范围...
- C 图像 API：进行中/完成/阻塞，改动范围...
```

---

## 14. 最终验收标准

最终不能只说“完成了”，必须满足：

```powershell
npm test
npm run build
```

并且浏览器验收通过：

```text
一进应用是样例方向的深色成品 UI，不是白底原型。
左侧栏展开/收起比例正确。
底部黑夜/中文/API/品牌按钮比例正确。
API 设置弹窗中文、无乱码、样式统一。
选择画布窗口刷新/删除 tooltip 中文正确。
画布可拖动。
Ctrl 框选可用。
Delete 删除可用。
节点 UI 有样例的小窗口感觉。
图片节点可点击导入、拖入导入。
提示词节点有字数显示。
连线可创建、可断开、可切断。
右上工具按钮是样例风格。
基因库替代 MS。
文生图、细节增强、图片编辑、角度控制、在线生图、GPT 页面不是空壳。
img2img 请求真实带图片。
inpaint 请求真实带原图和 mask。
输出回到画布。
刷新后画布内容不丢。
RAG 日志记录流程结构、输入、输出、耗时、失败和局部坐标。
```

---

## 15. 自检

这份计划覆盖：

- 样例 UI 差距。
- 样例画布交互差距。
- 我们 SPEC 的 MVP 验收。
- 图像 API 真实性。
- 看板/画布数据不丢。
- subagent 并行开发边界。
- 用户临时纠偏时的防跑偏机制。

当前没有要求立即执行代码修改。下一步如果开始执行，应先创建或确认 worktree，然后按第一轮低冲突并行：A、C、E 三条轨道启动。

