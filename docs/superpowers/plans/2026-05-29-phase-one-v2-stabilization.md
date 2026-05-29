# 第一阶段第二版稳定化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复第一阶段第一版验收中暴露的基础可用性问题，让 API 生成、图片导入、图生图输入链路先恢复为可测试状态，再处理画布核心交互和假入口清理。

**Architecture:** 第二版不继续堆新功能，先按用户反馈做稳定化。P0 任务只处理 API provider 持久化/可见诊断和图片上传导入链路；P1 任务处理无限画布基础交互；P2 任务清理假入口、重做 GPT 对话页和基因库二次交互。每个任务必须先写回归测试，再改实现。

**Tech Stack:** React 18、Vite、TypeScript、Express、Vitest、tldraw、local JSON persistence under `logs/`。

---

## 当前结论

第一阶段第一版已完成，但不再继续人工验收，因为两个基础能力已经阻断后续测试：

1. API 当前不可用：验证结果显示服务启动后 `/api/providers` 返回 `200`，但 `data: []`，执行生成返回 `no API provider configured`。核心问题不是基因库改坏 API，而是 provider 配置没有稳定保存/恢复，也缺少清楚的“未配置”引导。
2. 图片导入当前不可用：用户反馈图片完全导入不了，这会阻断图片节点、图生图、局部重绘、角度控制、图片编辑。

第二版执行顺序必须是：

1. 先修 API 配置和图片导入。
2. 用浏览器和接口验证一条最小链路：上传图片 -> 画布出现图片节点 -> API 设置存在可用 provider -> 图生图/文生图请求能走到正确 provider 或明确提示配置错误。
3. 再处理画布交互和 UI 清理。

---

## 反馈映射

| 反馈 | 第二版归类 | 优先级 |
|---|---|---|
| F-010 API 用不了/provider 为空 | API 配置与执行链路 | P0 |
| F-014 图片导入完全失败 | 图片导入与图片节点链路 | P0 |
| F-002 新节点不在当前视口中心 | 画布新建节点定位 | P1 |
| F-003 Ctrl+C / Ctrl+V 不可用 | 画布快捷键 | P1 |
| F-004 API 节点 prompt 压缩、seed/重复字段混乱 | API 节点 UI 与字段边界 | P1 |
| F-005 节点重合时上传/resize UI 漂浮 | 节点内部层级与重叠状态 | P1 |
| F-006 分组 UI 错乱 | 分组节点 UI | P1 |
| F-007 右键菜单是浏览器菜单 | 画布右键菜单 | P1 |
| F-008 基因库删除原生弹窗 | 基因库二版交互 | P2 |
| F-009 基因库范围语义不明 | 基因库二版文案与保存范围 | P2 |
| F-011 中英文假入口 | 底部设置入口清理 | P2 |
| F-012 黑夜/白天模式假入口或状态错误 | 主题入口与画布背景一致性 | P2 |
| F-013 GPT 对话页不实用 | GPT 对话页重构 | P2 |

---

## 文件结构

### API 配置与执行链路

- Modify: `src/services/providers.ts`
  - 增加 provider 状态诊断 helper，例如 `describeProviderReadiness(providers)`。
  - 保持 key 不对前端明文暴露。
- Modify: `src/services/providers.test.ts`
  - 覆盖 provider 为空、存在但无 key、存在 key、更新元数据保留 key。
- Modify: `src/routes/api.ts`
  - `/api/providers` 返回空 provider 时仍 200，但要包含诊断字段或前端可识别状态。
  - `/api/flows/execute` 对 `no API provider configured` 形成稳定错误，不要让用户误以为是按钮没反应。
- Modify: `web/src/panels/ApiSettings.tsx`
  - API 设置页必须清楚显示“未配置 API，生成不可用”。
  - 保存成功后立即刷新当前 provider 状态。
  - 验证/拉模型/保存按钮需要有明确状态。
- Modify: `web/src/api/client.ts`
  - 增加 provider readiness 类型，或至少增强错误解析，避免吞掉 `data` 里的失败细节。
- Test: `src/services/providers.test.ts`
- Test: 新增或修改 `web/src/panels/ApiSettings.test.tsx`

### 图片导入与图片节点链路

- Modify: `web/src/canvas/importImages.ts`
  - 扩展支持 `image/gif` 可选，重点确保无 MIME 但扩展名为 `.png/.jpg/.jpeg/.webp` 的文件也能识别。
  - 增加可测试的 `isSupportedImageFile(file)`。
- Modify: `web/src/canvas/importImages.test.ts`
  - 覆盖拖入文件、文件选择、剪贴板、空 MIME 场景。
- Modify: `web/src/App.tsx`
  - 图片导入入口统一调用一个 helper，避免画布拖入、按钮上传、功能页上传各走一套。
  - 上传成功后创建图片节点，位置必须落在当前视口中心。
  - 上传失败要显示明确错误，不静默失败。
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
  - 图片节点接受拖入图片时，必须把上传返回的 `assetId/url/name` 写回节点 data。
  - 图片节点点击导入和拖入导入走同一套逻辑。
- Modify: `web/src/canvas/TshuabuNodeShapeUtil.tsx`
  - 图片节点内部点击区域和 drop 区域不能被 resize 三角或节点外框遮挡。
- Test: `web/src/canvas/importImages.test.ts`
- Test: `web/src/canvas/ReferenceCanvas.model.test.ts`
- Test: 新增 `web/src/App.imageImport.test.tsx` 或补充可纯函数化测试。

### 无限画布基础交互

- Modify: `web/src/canvas/ReferenceCanvas.tsx`
  - 新增节点位置使用当前 viewport center。
  - 支持 Ctrl+C / Ctrl+V 复制粘贴选中节点，粘贴时整体偏移并保持内部连线。
  - 阻止默认浏览器右键菜单，显示画布上下文菜单。
  - Delete 删除要稳定，菜单文案要中文。
- Modify: `web/src/canvas/canvasInteractions.ts`
  - 把 viewport center、复制粘贴、避免重叠位移等逻辑抽成纯函数。
- Modify: `web/src/canvas/canvasInteractions.test.ts`
  - 覆盖视口中心新建、复制粘贴保留内部边、粘贴偏移。
- Modify: `web/src/canvas/TshuabuNodeShapeUtil.tsx`
  - 修 API 节点 prompt 行压缩。
  - 先移除或隐藏 seed/重复字段，循环交给循环节点。
  - 修节点重合时导入图片按钮和 resize 三角漂浮问题。

### 分组、右键菜单、节点 UI

- Modify: `web/src/canvas/ReferenceCanvas.tsx`
  - 分组节点外观、选中态、内部节点层级统一。
  - 右键菜单包含：新建图片、新建提示词、新建 API、粘贴、删除选中、创建分组。
- Modify: `web/styles.css`
  - 分组、右键菜单、节点内部 resize 控制和上传区域样式。
- Test: `web/src/canvas/ReferenceCanvas.model.test.ts`
  - 分组数据模型和菜单动作至少用纯函数覆盖。

### 假入口清理

- Modify: `web/src/App.tsx`
  - 中英文按钮：第二版默认隐藏，除非同时实现真实语言切换。
  - 黑夜/白天按钮：只保留真实可用状态；如果画布背景不能同步主题，就隐藏或禁用，并显示明确状态。
- Modify: `web/src/pages/__tests__/featurePages.test.tsx`
  - 删除对假入口常驻存在的测试，改成验证没有假入口或状态明确。

### GPT 对话页

- Modify: `web/src/pages/GptChatPage.tsx`
  - 重构为聊天结构：上方消息流、底部输入框、发送按钮、附件入口。
  - 不再复用图片生成页面的三栏参数面板。
  - 若后端聊天 API 未完成，则明确显示“需要 API 配置后发送”，不要做假对话。
- Test: `web/src/pages/__tests__/featurePages.test.tsx`
  - 验证页面包含消息流区域、输入框、发送按钮，不再出现图片生成式参数区。

### 基因库第二版交互

- Modify: `web/src/panels/GeneLibrary.tsx`
  - 删除使用自带 UI 确认弹窗，不用 `window.confirm`。
  - 删除确认浮层要贴近操作位置，符合当前暗色 UI。
  - 保存范围文案重写：例如“当前选中 / 选中+输出 / 全画布流程”，补充短说明。
- Modify: `web/src/panels/GeneLibrary.test.tsx`
  - 验证不再调用原生 confirm，范围文案更明确。

---

## Task 1: API provider 可用性和诊断

**Files:**
- Modify: `src/services/providers.ts`
- Modify: `src/services/providers.test.ts`
- Modify: `src/routes/api.ts`
- Modify: `web/src/api/client.ts`
- Modify: `web/src/panels/ApiSettings.tsx`
- Test: `src/services/providers.test.ts`
- Test: `web/src/panels/ApiSettings.test.tsx`

- [ ] **Step 1: 写 provider readiness 失败测试**

在 `src/services/providers.test.ts` 增加测试：

```ts
it("describes provider readiness for empty and configured states", async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "providers-"));
  const store = createProviderStore(path.join(tempDir, "providers.json"));

  expect(await store.describeReadiness()).toEqual({
    ready: false,
    reason: "no_provider",
    message: "未配置 API 平台"
  });

  await store.saveProviders([
    {
      id: "miku",
      name: "Miku API",
      baseUrl: "https://mikuapi.org/v1",
      protocol: "openai",
      enabled: true,
      primary: true,
      apiKey: "sk-1234567890abcdef",
      imageModels: ["gpt-image-2"]
    }
  ]);

  expect(await store.describeReadiness()).toMatchObject({
    ready: true,
    reason: "ready",
    primaryProviderId: "miku"
  });
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- src/services/providers.test.ts`

Expected: `describeReadiness is not a function`。

- [ ] **Step 3: 实现 `describeReadiness`**

在 `createProviderStore` 内增加：

```ts
async function describeReadiness() {
  const providers = await loadProviders();
  const enabled = providers.filter((provider) => provider.enabled);
  const primary = enabled.find((provider) => provider.primary) ?? enabled[0];

  if (!primary) {
    return { ready: false, reason: "no_provider" as const, message: "未配置 API 平台" };
  }

  if (!primary.apiKey?.trim()) {
    return {
      ready: false,
      reason: "missing_key" as const,
      message: `${primary.name} 缺少 API Key`,
      primaryProviderId: primary.id
    };
  }

  return {
    ready: true,
    reason: "ready" as const,
    message: `${primary.name} 已可用于生成`,
    primaryProviderId: primary.id
  };
}
```

并导出到 store 返回对象。

- [ ] **Step 4: 前后端 API 返回 readiness**

`GET /api/providers` 返回：

```ts
res.json({
  ok: true,
  data: providers.map(publicProvider),
  meta: {
    readiness: await providerStore.describeReadiness()
  }
});
```

`web/src/api/client.ts` 增加类型并读取 `json.meta?.readiness`。如果暂时不想改 `fetchProviders()` 返回值，则新增 `fetchProviderState()`，不要破坏现有调用。

- [ ] **Step 5: API 设置页显示明确状态**

`ApiSettings` 顶部显示：

```tsx
{providers.length === 0 ? (
  <p className="api-warning">未配置 API 平台，画布生成暂不可用。请填写请求地址、API Key，并保存。</p>
) : null}
```

保存成功后必须 `onProvidersChange(saved)`，并显示 `已保存，可用于生成` 或后端 readiness message。

- [ ] **Step 6: 验证**

Run:

```powershell
npm test -- src/services/providers.test.ts web/src/panels/ApiSettings.test.tsx
npm test
npm run build
```

Expected: 全部通过。

Manual:

```powershell
npm run dev -- serve:web
npm run dev:web -- --port 5173
```

访问 `http://127.0.0.1:5173/api/providers`，空配置时应显示 `meta.readiness.reason = "no_provider"`。

- [ ] **Step 7: Commit**

```powershell
git add src/services/providers.ts src/services/providers.test.ts src/routes/api.ts web/src/api/client.ts web/src/panels/ApiSettings.tsx web/src/panels/ApiSettings.test.tsx
git commit -m "fix: expose api provider readiness"
```

---

## Task 2: 图片导入恢复

**Files:**
- Modify: `web/src/canvas/importImages.ts`
- Modify: `web/src/canvas/importImages.test.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/canvas/TshuabuNodeShapeUtil.tsx`

- [ ] **Step 1: 写图片识别失败测试**

在 `web/src/canvas/importImages.test.ts` 增加：

```ts
it("accepts image files by extension when mime type is missing", () => {
  const files = [
    new File(["a"], "a.PNG", { type: "" }),
    new File(["b"], "b.jpeg", { type: "" }),
    new File(["c"], "c.webp", { type: "" }),
    new File(["d"], "d.txt", { type: "" })
  ];

  expect(imageFilesFromList(files).map((file) => file.name)).toEqual(["a.PNG", "b.jpeg", "c.webp"]);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- web/src/canvas/importImages.test.ts`

Expected: 新测试失败，只返回空数组或漏掉空 MIME 文件。

- [ ] **Step 3: 实现 `isSupportedImageFile`**

`web/src/canvas/importImages.ts`：

```ts
const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function isSupportedImageFile(file: File): boolean {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }
  const name = file.name.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function imageFilesFromList(files: Iterable<File>): File[] {
  return [...files].filter(isSupportedImageFile);
}
```

- [ ] **Step 4: 统一上传入口**

在 `web/src/App.tsx` 抽出一个局部 helper：

```ts
const uploadFileAsImageNode = useCallback(
  async (file: File, placement?: { x: number; y: number }) => {
    const uploaded = await uploadImage(file, session?.sessionId);
    setSessionId(uploaded.sessionId);
    addImageNode({
      assetId: uploaded.asset.assetId,
      url: uploaded.asset.publicUrl,
      name: file.name,
      x: placement?.x,
      y: placement?.y
    });
    setStatus(`已导入 ${file.name}`);
  },
  [session?.sessionId, addImageNode]
);
```

如果现有 `addImageNode` 不接受坐标，先在 Task 3 抽出的 viewport center helper 合并，不能继续写死原点。

- [ ] **Step 5: 图片节点内部点击/拖入写回 data**

`ReferenceCanvas.tsx` 和 `TshuabuNodeShapeUtil.tsx` 中图片节点的 drop/click 入口必须更新：

```ts
onImageImported(nodeId, {
  assetId: uploaded.asset.assetId,
  url: uploaded.asset.publicUrl,
  name: file.name
});
```

节点 data 至少包含：

```ts
{
  assetId: uploaded.asset.assetId,
  url: uploaded.asset.publicUrl,
  name: file.name
}
```

- [ ] **Step 6: 验证上传接口**

Run:

```powershell
npm test -- web/src/canvas/importImages.test.ts web/src/canvas/ReferenceCanvas.model.test.ts
npm test
npm run build
```

Manual:

1. 启动前后端。
2. 在画布拖入 `.png`。
3. 预期：画布当前视口附近出现图片节点，节点内显示图片。
4. 点击图片节点内部导入。
5. 预期：节点 data 更新，图片可预览，Inspector 中 assetId 存在。

- [ ] **Step 7: Commit**

```powershell
git add web/src/canvas/importImages.ts web/src/canvas/importImages.test.ts web/src/App.tsx web/src/canvas/ReferenceCanvas.tsx web/src/canvas/TshuabuNodeShapeUtil.tsx
git commit -m "fix: restore image import pipeline"
```

---

## Task 3: 画布新建、复制粘贴、右键菜单

**Files:**
- Modify: `web/src/canvas/canvasInteractions.ts`
- Modify: `web/src/canvas/canvasInteractions.test.ts`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 写视口中心新建测试**

`web/src/canvas/canvasInteractions.test.ts`：

```ts
it("places new nodes at the viewport center", () => {
  expect(nodePositionFromViewport({ x: -400, y: -300, zoom: 1 }, { width: 1200, height: 800 }, { width: 260, height: 180 })).toEqual({
    x: 870,
    y: 610
  });
});
```

- [ ] **Step 2: 写复制粘贴测试**

```ts
it("copies selected nodes with internal edges and offsets pasted nodes", () => {
  const result = cloneSelectedSubgraph(
    {
      nodes: [
        { id: "p1", type: "prompt", x: 0, y: 0, width: 100, height: 100, data: {} },
        { id: "g1", type: "api_text2img", x: 160, y: 0, width: 100, height: 100, data: {} }
      ],
      edges: [{ id: "e1", from: "p1", to: "g1" }]
    },
    ["p1", "g1"],
    { x: 40, y: 40 }
  );

  expect(result.nodes).toHaveLength(2);
  expect(result.edges).toHaveLength(1);
  expect(result.nodes[0].x).toBe(40);
});
```

- [ ] **Step 3: 实现 helper 并接入 tldraw 事件**

实现：

```ts
export function nodePositionFromViewport(viewport, viewportSize, nodeSize) {
  return {
    x: (-viewport.x + viewportSize.width / 2) / viewport.zoom - nodeSize.width / 2,
    y: (-viewport.y + viewportSize.height / 2) / viewport.zoom - nodeSize.height / 2
  };
}
```

复制粘贴由 `ReferenceCanvas.tsx` 捕获 Ctrl+C / Ctrl+V，存入本地 clipboard state，不使用系统剪贴板 JSON。

- [ ] **Step 4: 右键菜单**

阻止默认菜单：

```ts
onContextMenu={(event) => {
  event.preventDefault();
  openCanvasContextMenu({ x: event.clientX, y: event.clientY });
}}
```

菜单项中文：

```ts
["新建图片", "新建提示词", "新建 API", "粘贴", "删除选中", "创建分组"]
```

- [ ] **Step 5: 验证**

Run:

```powershell
npm test -- web/src/canvas/canvasInteractions.test.ts web/src/canvas/ReferenceCanvas.model.test.ts
npm test
npm run build
```

Manual:

1. 移动画布后新建图片/提示词，节点出现在当前视口中心。
2. Ctrl+C / Ctrl+V 复制两个有连线节点，粘贴后保持内部线。
3. 右键画布不出现浏览器菜单。

- [ ] **Step 6: Commit**

```powershell
git add web/src/canvas/canvasInteractions.ts web/src/canvas/canvasInteractions.test.ts web/src/canvas/ReferenceCanvas.tsx web/src/App.tsx web/styles.css
git commit -m "fix: stabilize canvas core interactions"
```

---

## Task 4: API 节点 UI 和图生图输入链路

**Files:**
- Modify: `web/src/canvas/TshuabuNodeShapeUtil.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/canvas/flowCompiler.ts`
- Modify: `web/src/canvas/flowCompiler.test.ts`

- [ ] **Step 1: 写图生图编译测试**

在 `flowCompiler.test.ts` 增加：图片节点 -> 图生图 API -> Output 必须编译出 `baseAssetId`。

```ts
it("compiles image to img2img api as base asset input", () => {
  const flow = compileCanvasFlow({
    canvasId: "c1",
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: "img", type: "image", x: 0, y: 0, width: 100, height: 100, data: { assetId: "asset_base", url: "/outputs/base.png" } },
      { id: "api", type: "api_img2img", x: 160, y: 0, width: 100, height: 100, data: { model: "gpt-image-2" } },
      { id: "out", type: "output", x: 320, y: 0, width: 100, height: 100, data: {} }
    ],
    edges: [
      { id: "e1", from: "img", to: "api" },
      { id: "e2", from: "api", to: "out" }
    ]
  });

  expect(flow.nodes.find((node) => node.id === "api")?.data.baseAssetId).toBe("asset_base");
});
```

- [ ] **Step 2: API 节点 UI 简化**

第二版先移除/隐藏 seed 和重复字段。API 节点只保留：

```text
平台
模型
输入图片状态（图生图/局部重绘）
运行状态
```

Prompt 来自提示词节点连线，不再在图生图节点里放提示词覆盖、负面提示词覆盖等额外窗口。

- [ ] **Step 3: 验证**

Run:

```powershell
npm test -- web/src/canvas/flowCompiler.test.ts web/src/canvas/ReferenceCanvas.model.test.ts
npm test
npm run build
```

Manual:

1. 图片节点连到图生图节点。
2. 提示词节点连到图生图节点。
3. 图生图节点连到 Output。
4. 执行时请求 payload 必须走 img2img，而不是图转文再文生图。

- [ ] **Step 4: Commit**

```powershell
git add web/src/canvas/TshuabuNodeShapeUtil.tsx web/src/canvas/ReferenceCanvas.tsx web/src/canvas/flowCompiler.ts web/src/canvas/flowCompiler.test.ts
git commit -m "fix: align api node inputs with canvas links"
```

---

## Task 5: UI 假入口和 GPT 对话页

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/GptChatPage.tsx`
- Modify: `web/src/pages/__tests__/featurePages.test.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 改测试**

功能页测试要验证：

```ts
expect(html).not.toContain("中英文切换");
expect(html).not.toContain("假语言");
expect(html).toContain("GPT 对话");
expect(html).toContain("chat-composer");
```

- [ ] **Step 2: 底部按钮清理**

中英文入口先隐藏。黑夜/白天按钮如果无法让画布和页面一致，就先隐藏或禁用，不允许显示为常亮可用。

- [ ] **Step 3: GPT 对话页重构**

结构：

```tsx
<section className="chat-page">
  <div className="chat-thread">{messages}</div>
  <form className="chat-composer">
    <textarea placeholder="输入你要问 GPT 的内容" />
    <button type="submit">发送</button>
  </form>
</section>
```

如果后端聊天 API 未接入，发送按钮显示“需要 API 配置”，不能假装回复。

- [ ] **Step 4: 验证与提交**

Run:

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm test
npm run build
```

Commit:

```powershell
git add web/src/App.tsx web/src/pages/GptChatPage.tsx web/src/pages/__tests__/featurePages.test.tsx web/styles.css
git commit -m "fix: remove fake settings and simplify gpt chat"
```

---

## Task 6: 基因库第二版交互

**Files:**
- Modify: `web/src/panels/GeneLibrary.tsx`
- Modify: `web/src/panels/GeneLibrary.test.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 删除原生 confirm**

测试中 mock `window.confirm`，确保删除流程不调用它。

- [ ] **Step 2: 增加贴近按钮的删除确认 UI**

在基因 tile 内显示：

```tsx
{pendingDeleteId === gene.id ? (
  <div className="gene-delete-confirm">
    <span>删除这个基因？</span>
    <button>取消</button>
    <button>删除</button>
  </div>
) : null}
```

- [ ] **Step 3: 范围文案改清楚**

范围按钮改为：

```ts
[
  { label: "当前选中", title: "只保存选中的节点和它们之间的连线" },
  { label: "选中+输出", title: "保存选中节点，并带上直接相连的 Output 节点" },
  { label: "全画布流程", title: "保存当前画布上的全部节点和连线" }
]
```

- [ ] **Step 4: 验证与提交**

Run:

```powershell
npm test -- web/src/panels/GeneLibrary.test.tsx web/src/panels/geneLibraryModel.test.ts
npm test
npm run build
```

Commit:

```powershell
git add web/src/panels/GeneLibrary.tsx web/src/panels/GeneLibrary.test.tsx web/styles.css
git commit -m "fix: refine gene library interactions"
```

---

## 第二版验收门槛

第二版不以“测试通过”单独作为完成标准，必须同时满足浏览器手工验收：

1. 访问 `http://127.0.0.1:5173/` 能打开前端。
2. `http://127.0.0.1:5173/api/providers` 有明确 readiness。
3. API 未配置时，页面明确提示，不是按钮无反应。
4. 保存 API 配置后，刷新页面仍能看到 provider。
5. 拖入图片能出现图片节点。
6. 点击图片节点内部导入能更新节点图片。
7. 图片节点 + 提示词节点 + 图生图 API + Output 的链路能编译为 img2img 请求。
8. 新建节点出现在当前视口中心。
9. Ctrl+C / Ctrl+V 可复制粘贴选中节点。
10. 右键菜单不再是浏览器菜单。
11. 中英文、黑夜/白天没有假可用入口。
12. GPT 对话页是聊天结构，不再是图片生成参数页。

---

## 执行方式

推荐使用 subagent 风格执行，但每个任务必须独立分支或独立 worktree，不能互相改同一文件后直接并发合并。

建议执行顺序：

1. Task 1 API provider 可用性和诊断。
2. Task 2 图片导入恢复。
3. Task 4 API 节点 UI 和图生图输入链路。
4. Task 3 画布新建、复制粘贴、右键菜单。
5. Task 5 UI 假入口和 GPT 对话页。
6. Task 6 基因库第二版交互。

每个任务完成后：

```powershell
npm test
npm run build
git status --short
```

只有当前任务测试、全量测试和构建通过，才允许提交并进入下一任务。

