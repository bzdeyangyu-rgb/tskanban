# Infinite Canvas 案例前端解剖报告

日期：2026-05-21  
目标：停止“相似风格改造”，改为基于 `references/Infinite-Canvas` 做前端复刻报告，再进入实施。

## 结论

当前 UI 问题不是单个样式没调好，而是信息架构和交互机制没有按案例复刻：

1. 侧栏被我改成了自己的功能抽屉，这和案例不一致。
2. API 设置被我放在上方/抽屉里，又在底部出现，形成重复入口。
3. “本地素材”不应该是 studio 侧栏一级入口；素材导入属于无限画布内部能力。
4. 连线不能用 tldraw 默认 arrow 拼；案例是 DOM 节点端口 + SVG 曲线 + 命令菜单的自研连接系统。
5. 如果目标是完全复刻案例前端，必须先还原案例的页面壳、侧栏、iframe/page 概念、画布门页、画布编辑层，再接我们自己的业务内核。

后续不再做“我觉得这样也像”的设计。执行标准改为：案例有的结构照搬，案例没有的入口先不放。

## 案例前端组成

### 1. Studio 外壳

来源：`D:/Tskanban/references/Infinite-Canvas/static/index.html`

职责：

- 全局主题 token。
- 左侧 sidebar。
- 主舞台 `.stage`。
- 多 iframe/page 切换。
- 左下角 `ONLINE / QUEUE` 状态监视器。
- 主题、语言、API、ComfyUI 设置入口。
- 作者/品牌区域。

关键 DOM：

```html
<div class="app-shell">
  <aside class="sidebar">...</aside>
  <main class="stage">
    <iframe id="frame-zimage"></iframe>
    <iframe id="frame-enhance"></iframe>
    <iframe id="frame-klein"></iframe>
    <iframe id="frame-angle"></iframe>
    <iframe id="frame-online"></iframe>
    <iframe id="frame-gpt-chat"></iframe>
    <iframe id="frame-canvas"></iframe>
    <iframe id="frame-api-settings"></iframe>
    <iframe id="frame-comfyui-settings"></iframe>
    <div class="nano-monitor">...</div>
  </main>
</div>
```

我们当前不一定要真的使用 iframe，但视觉和状态结构要复刻。React 里可以用 route/component 替代 iframe，但类名、布局、切换行为和视觉层级应与案例一致。

### 2. 侧栏信息架构

案例上方导航：

- 文生图
- 细节增强
- 图片编辑
- 角度控制
- 在线生图
- GPT 对话
- 无限画布

案例底部设置：

- 黑夜模式
- 中文
- API 设置
- ComfyUI 设置

案例底部品牌：

- 默认收缩态显示 `D` / `X`
- hover 展开后显示作者名和社交链接

我们的复刻要求：

- 不能在上方再加 `API 设置`，因为案例 API 在底部。
- 不能在上方加 `本地素材`，因为案例没有这个一级入口。
- 不能把 `无限画布` 和 `本地素材` 并列，素材属于无限画布内部。
- 品牌要替换成 `Side`。可保留案例动效结构，但文案换成 `Side`，社交链接不接。

建议最终侧栏：

上方导航完全按案例：

- 文生图
- 细节增强
- 图片编辑
- 角度控制
- 在线生图
- GPT 对话
- 无限画布

底部设置完全按案例：

- 黑夜模式
- 中文
- API 设置
- ComfyUI 设置

品牌：

- 收缩态：`S` / `D` 或 `Side` 小标。
- 展开态：`Side`。

如果某些上方页面暂未实现，视觉仍可保留，但点击后应进入占位 page，不能跳到错误抽屉，也不能把它们替换成本地素材/API 这种自造入口。

### 3. 侧栏视觉行为

来源：`index.html`

核心规则：

- `.sidebar` 默认宽 `80px`。
- hover 后宽 `220px`。
- `.nav-item` 默认 `48px`，hover 后 `190px`。
- `.nav-text` 默认 opacity 0，hover 后 opacity 1。
- `.side-pill` 默认 `44px x 36px`，hover 后 `170px`。
- logo hover 会旋转并变圆。

我们当前错误：

- 把侧栏做成了常驻展开态。
- 文案和按钮看起来像自己设计的面板，不像案例。
- 底部按钮已经有 API/ComfyUI 后，上方又出现 API 入口，重复。

复刻标准：

- 侧栏默认必须是收缩态。
- hover 展开必须有延迟和流动感。
- 文案不能常驻显示。
- API/ComfyUI 只能在底部 side pill。

### 4. 画布入口状态

来源：`canvas.html`

无画布时：

```html
<div id="shell" class="shell no-canvas">
  <div id="canvasGate" class="canvas-gate">
    <div class="gate-panel">
      <div class="gate-head">...</div>
      <div id="gateCanvasList" class="gate-list"></div>
    </div>
  </div>
</div>
```

关键状态：

- `.shell.no-canvas .topbar { display:none; }`
- `.shell.no-canvas .editor-only { display:none; }`
- `.shell:not(.no-canvas) .canvas-gate { display:none; }`

复刻标准：

- 一进无限画布不是直接进入编辑器，而是选择画布门页。
- 门页按钮：刷新、回收站、新建画布。
- 门页列表是 canvas card，不是素材列表。

### 5. 画布编辑层

来源：`canvas.html`

核心 DOM：

```html
<div id="board" class="board editor-only">
  <div id="dropOverlay" class="drop-overlay"></div>
  <div id="selectionBox" class="selection-box"></div>
  <div id="selectionHub" class="selection-hub"></div>
  <div id="createMenu" class="create-menu"></div>
  <div id="linkCreateMenu" class="create-menu"></div>
  <div id="nodeInputMenu" class="create-menu"></div>
  <div id="nodeOutputMenu" class="create-menu"></div>
  <div id="imageNodeMenu" class="create-menu"></div>
  <div id="world" class="world">
    <svg id="links" class="links"></svg>
    <div id="linkControls" class="link-controls"></div>
    <div id="nodes"></div>
  </div>
</div>
```

这说明案例的画布并不是简单“节点卡片 + tldraw 默认箭头”。它有一套完整 DOM 画布层。

复刻标准：

- board/world/links/nodes/linkControls/createMenu 这些层级要保留。
- 节点在 `nodes` 层。
- 连线在 `svg.links` 层。
- 删除线按钮在 `linkControls` 层。
- 命令菜单是独立 `.create-menu`。

### 6. 连线机制

来源：`canvas.html`

关键函数：

- `startLink(e, originId, originKind)`
- `nearestPort(clientX, clientY, kind)`
- `openLinkCreateMenu(originId, originKind, clientX, clientY)`
- `createLinkedNode(type)`
- `renderLinks()`
- `portPoint(id, kind)`
- `pathEl(x1, y1, x2, y2, cls)`

交互路径：

1. 鼠标按下节点端口。
2. `startLink` 创建 `tempLink`。
3. mousemove 更新 `tempLink.x2/y2`。
4. `renderLinks` 画临时 SVG 曲线。
5. mouseup 判断是否落到目标端口。
6. 如果落到端口，写入 `connections`。
7. 如果没有目标端口，打开 `linkCreateMenu`。
8. 点击菜单后 `createLinkedNode` 创建节点并写入 `connections`。

当前我们的问题：

- 用 tldraw arrow binding 创建线，导致视觉、热区、菜单和删除行为都不像案例。
- 端口尺寸和位置不对。
- 命令菜单只是浮出来，没有成为连接系统的一部分。

复刻标准：

- 不再用 tldraw arrow 作为主要连线。
- 连接数据使用我们自己的 `connections`。
- 画线使用 SVG path。
- 命令菜单位置使用鼠标松手位置。
- 已有连线 hover 要有命中区域和删除按钮。

### 7. 节点系统

案例节点类型：

- image
- prompt
- loop
- group
- promptGroup
- llm
- generator/API
- msgen
- video
- comfy
- output

第一阶段可完整复刻视觉和菜单，但功能可分级：

- 必须可用：image、prompt、api_text2img、api_img2img、api_inpaint、output。
- 可先视觉占位：loop、group、llm、msgen、video、comfy。

注意：视觉菜单可以照抄，但不可用功能必须有明确 disabled/coming soon 状态，不能假装能跑。

### 8. 顶部工具栏

案例无限画布顶部工具栏只在有画布时出现：

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

复刻标准：

- 不要把这些散到左右抽屉里。
- 顶部 toolbar 是画布编辑层的一部分。
- API 设置不是这里的入口；这里的 `API生成` 是节点类型。

### 9. 主题和语言

案例状态：

- `studio_theme`
- `canvas_theme`
- `studio_lang`
- `postMessage({ type:'studio-theme' })`
- `postMessage({ type:'studio-lang' })`

当前问题：

- 我们混了白天和黑夜样式，进入编辑器后出现白底。

复刻标准：

- 第一阶段默认强制黑夜模式。
- 主题按钮可以保留，但先不要真的切白天，避免半套 UI。
- 等全部 dark 复刻完成，再做 light 主题。

### 10. 我们现有实现要删除/降级的内容

必须从侧栏一级入口删除：

- 本地素材
- 节点工具
- API 设置
- 运行记录

这些不是案例上方导航结构。

归属调整：

- 本地素材：进入无限画布后通过 image node / drop overlay / 图片按钮处理。
- 节点工具：进入无限画布后通过顶部 toolbar 和右键/create menu 处理。
- API 设置：底部 side pill。
- 运行记录：无限画布内部日志按钮。

## 推荐实施路线

### Phase A：复刻 Studio Shell

目标：先把左侧和舞台完全做对。

- 侧栏按案例 DOM/CSS 重写。
- 上方导航按案例保留。
- 底部 settings 按案例保留。
- `Side` 替换原作者标识。
- 主题默认 dark。
- 当前 active page 默认 `canvas`。

### Phase B：复刻 Canvas Gate

目标：选择画布门页完全照案例。

- `shell no-canvas`
- `canvas-gate`
- `gate-panel`
- 刷新/回收站/新建
- canvas card list

### Phase C：复刻 Canvas Board

目标：进入画布后的层级照案例。

- board
- world
- links svg
- linkControls
- nodes
- create menus
- selection box/hub
- drop overlay

### Phase D：复刻节点和连线

目标：先实现案例同款连接体验。

- 节点 DOM 卡片。
- in/out port。
- SVG cubic path。
- temp link。
- link create menu。
- create linked node。
- line hover/delete。

### Phase E：接入我们自己的业务内核

目标：视觉不动，只替换 API 和数据。

- API provider 使用我们现有后端。
- image upload 使用我们现有 upload。
- flow execution 使用我们现有 execute。
- canvas snapshot 使用我们现有 save/load。

## 验收标准

1. 首屏侧栏和案例一致，不出现自造的本地素材/API 顶部入口。
2. 默认激活无限画布。
3. API/ComfyUI 只在底部设置区。
4. 左下品牌显示 Side。
5. 进入无限画布先看到选择画布门页。
6. 画布编辑层不出现白底。
7. 从节点端口拖线时出现案例同款 SVG 曲线。
8. 松手空白处出现命令菜单。
9. 选择菜单后创建子节点并保留连接。
10. 未实现功能不假装可用。

## 对当前工作的评价

当前这几轮改动可以作为“试错记录”，但不适合作为继续叠加的基础。原因：

- `App.tsx` 已经混入了自造 shell、抽屉、画布 gate、tldraw overlay，职责太乱。
- `styles.css` 已经多次追加覆盖，和案例 token 不再一一对应。
- 连线技术路线错了。
- 侧栏信息架构错了。

建议下一步不是继续小 patch，而是基于本报告新开一次前端复刻任务，按阶段替换。
