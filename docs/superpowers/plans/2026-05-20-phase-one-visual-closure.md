# 第一阶段视觉闭环补齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐第一阶段验收闭环，让图片导入、节点运行、Output 回显、画布持久化、版本链和 RAG 追踪都能稳定串起来，并让视觉对齐 `references/Infinite-Canvas` 的成熟方案。

**Architecture:** 保留现有 React + tldraw 前端和 Express 后端。后端负责画布快照保存、流程执行、版本链、RAG 事件；前端负责图片导入、节点卡片视觉、状态回写和 Output 节点展示。视觉不复制案例项目大单文件，只抽取深色点阵画布、浮动面板、节点卡片、状态徽章和输出网格这些产品模式。

**Tech Stack:** TypeScript、React、Vite、tldraw、Express、Zod、Vitest、现有 session/assets/logger/services。

---

## 文件结构

- 修改 `src/types/contracts.ts`：扩展 canvas/output 节点数据契约，保持 API 入参稳定。
- 修改 `src/logger.ts`：增加 `canvas_id`、`canvas_snapshot_path`、`target_node_id`、`run_id`、`node_inputs` 等 RAG 字段，并扩展过滤能力。
- 修改 `src/routes/api.ts`：`POST /api/flows/execute` 执行前自动保存画布快照，执行后写聚合事件与节点级事件。
- 修改 `src/services/sessions.ts`：确保 run/version 中保留 source run、source node、parent assets、output assets。
- 修改 `src/flows/execute.ts`：保持执行结果包含足够数据，供路由生成节点级 RAG 事件。
- 修改 `web/src/api/client.ts`：补齐 `uploadImage`，统一上传返回类型。
- 修改 `web/src/canvas/flowTypes.ts`：补充节点数据类型辅助定义，尤其是 image/output 节点数据。
- 修改 `web/src/canvas/shapeUtils.ts`：支持创建自定义 Tshuabu 节点 shape，恢复历史画布，更新节点状态和 Output 数据。
- 创建 `web/src/canvas/TshuabuNodeShapeUtil.tsx`：tldraw 自定义节点 shape，用 React 渲染案例风格节点卡片。
- 创建 `web/src/canvas/importImages.ts`：文件选择、拖拽、粘贴导入的共享逻辑。
- 修改 `web/src/canvas/CanvasApp.tsx`：注册自定义节点 shape，并接入拖拽/粘贴事件。
- 修改 `web/src/App.tsx`：接入上传导入、运行状态回写、Output 节点写入、自动保存状态。
- 创建或修改 `web/src/panels/AssetImportPanel.tsx`：左侧素材/导入面板，承载文件选择入口。
- 修改 `web/src/panels/NodePalette.tsx`：保留节点创建入口，视觉改成案例式工具按钮。
- 修改 `web/src/panels/RunPanel.tsx`：显示运行中、失败节点、成功节点数量。
- 修改 `web/styles.css`：切换为深色点阵画布、浮动面板、节点卡片、状态徽章、输出网格。
- 新增/修改测试：
  - `src/logger.test.ts`
  - `src/routes/api.test.ts` 或可测路由 helper 测试
  - `web/src/canvas/shapeUtils.test.ts`
  - `web/src/canvas/importImages.test.ts`
  - `web/src/canvas/flowCompiler.test.ts`

---

## Task 1: 后端运行时自动保存画布快照

**Files:**
- Modify: `src/routes/api.ts`
- Modify: `src/services/canvases.ts`
- Test: `src/phase-one-closure.test.ts`

- [ ] **Step 1: 写失败测试，证明执行流程必须保存 canvas**

在 `src/phase-one-closure.test.ts` 增加一个用例，直接调用 `saveCanvas` 不是目标；目标是覆盖“运行闭环需要产生可恢复快照”的业务预期。先用 helper 方式表达，后续如果路由逻辑抽出为 `executeCanvasRun`，测试直接调 helper。

```ts
it("requires a canvas snapshot path for every accepted phase-one run", async () => {
  const flow = phaseOneFlow();
  const s = session();
  const runId = "run_with_canvas_snapshot";

  await saveCanvas({ ...flow, title: "Auto Saved Canvas" });
  const restored = await loadCanvas(canvasId);
  const run = appendRunRecord(s, {
    runId,
    flowId: runId,
    canvasId,
    status: "success",
    startedAt: "2026-05-20T00:00:00.000Z",
    completedAt: "2026-05-20T00:00:01.000Z",
    latencyMs: 1000,
    snapshot: restored,
    nodes: []
  });

  expect(restored.canvasId).toBe(canvasId);
  expect(run.snapshot.canvasId).toBe(canvasId);
  expect(run.snapshot.nodes.map((node) => node.id)).toContain("img2img1");
});
```

- [ ] **Step 2: 运行测试，确认当前测试可作为保护网**

Run:

```powershell
npm.cmd test -- src/phase-one-closure.test.ts
```

Expected: PASS。这个测试确认快照结构可恢复，下一步把路由也接进同一机制。

- [ ] **Step 3: 在 `/api/flows/execute` 执行前保存画布**

修改 `src/routes/api.ts` 的新版 `apiRouter.post("/flows/execute"...`。在解析 input 和创建 session 后，创建 `snapshotToSave` 并调用 `saveCanvas`：

```ts
const input = canvasExecuteSchema.parse(req.body ?? {});
const session = await getOrCreateSession(input.sessionId ?? input.flow.sessionId);
const savedCanvas = await saveCanvas({
  ...input.flow,
  sessionId: session.sessionId,
  title: typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : "当前画布"
});
```

后续 `appendRunRecord` 使用 `savedCanvas` 作为 snapshot：

```ts
snapshot: savedCanvas,
```

- [ ] **Step 4: 在响应中返回保存时间和 canvas id**

把 `data` 扩展为：

```ts
data: {
  sessionId: session.sessionId,
  flowId,
  runId,
  canvas: {
    canvasId: savedCanvas.canvasId,
    updatedAt: savedCanvas.updatedAt
  },
  nodes: result.nodes,
  outputAssets: result.nodes.flatMap((node) => node.outputAssets ?? []),
  run: runRecord
}
```

- [ ] **Step 5: 运行后端相关测试**

Run:

```powershell
npm.cmd test -- src/services/canvases.test.ts src/services/sessions.test.ts src/phase-one-closure.test.ts
```

Expected: PASS。

---

## Task 2: 扩展 RAG 事件字段和过滤能力

**Files:**
- Modify: `src/logger.ts`
- Modify: `src/logger.test.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: 写 logger 字段测试**

在 `src/logger.test.ts` 增加测试，验证新增字段不会丢失，并且 `filterEvents` 可以按 `runId`、`assetId`、`keyword` 命中。

```ts
it("keeps canvas and node trace fields for RAG reconstruction", () => {
  const event: RagEvent = {
    event_id: "e1",
    timestamp: "2026-05-20T00:00:00.000Z",
    session_id: "s1",
    action: "flow_execute",
    model: "m1",
    prompt: "restore style",
    params: {},
    input_assets: ["asset_base"],
    output_assets: ["asset_out"],
    status: "success",
    latency_ms: 120,
    canvas_id: "c1",
    canvas_snapshot_path: "logs/canvases/c1.json",
    run_id: "run1",
    node_id: "node_api",
    node_type: "api_img2img",
    node_status: "success",
    node_inputs: { prompt: "restore style", inputAssetIds: ["asset_base"] },
    node_latency_ms: 120
  };

  expect(filterEvents([event], { runId: "run1" })).toEqual([event]);
  expect(filterEvents([event], { assetId: "asset_out" })).toEqual([event]);
  expect(filterEvents([event], { keyword: "restore" })).toEqual([event]);
});
```

- [ ] **Step 2: 扩展 `RagEvent` 类型**

在 `src/logger.ts` 的 `RagEvent` 中加入：

```ts
canvas_id?: string | undefined;
canvas_snapshot_path?: string | undefined;
target_node_id?: string | undefined;
run_id?: string | undefined;
node_inputs?: Record<string, unknown> | undefined;
```

- [ ] **Step 3: 更新 Markdown 输出**

在 `toMarkdownBlock` 中追加 run/canvas/node input 摘要：

```ts
const canvasInfo = event.canvas_id ? `\n- canvas: ${event.canvas_id}` : "";
const runInfo = event.run_id ? `\n- run: ${event.run_id}` : "";
const nodeInputsInfo = event.node_inputs ? `\n- node_inputs: ${JSON.stringify(event.node_inputs)}` : "";
```

并把它们加入返回模板：

```ts
...${flowInfo}${canvasInfo}${runInfo}${nodeInfo}${retryInfo}${nodeInputsInfo}${selectionInfo}${error}\n`
```

- [ ] **Step 4: 更新 `filterEvents`**

确保 `runId` 同时匹配 `event.run_id`、`event.flow_id` 和 `event.params.runId`：

```ts
if (query.runId) {
  const paramRunId = typeof event.params.runId === "string" ? event.params.runId : undefined;
  if (event.run_id !== query.runId && event.flow_id !== query.runId && paramRunId !== query.runId) {
    return false;
  }
}
```

- [ ] **Step 5: 更新前端 `RagEvent` 类型**

在 `web/src/api/client.ts` 的 `RagEvent` 类型中加入同名字段，避免前端历史面板读取时丢类型。

- [ ] **Step 6: 运行测试**

Run:

```powershell
npm.cmd test -- src/logger.test.ts
```

Expected: PASS。

---

## Task 3: 为流程执行写聚合事件和节点级 RAG 事件

**Files:**
- Modify: `src/routes/api.ts`
- Modify: `src/flows/execute.ts`
- Test: `src/phase-one-closure.test.ts`

- [ ] **Step 1: 导出并复用节点输入编译结果**

`src/flows/execute.ts` 已导出 `compileNodeInputs`。在路由中使用执行结果和 flow 快照重建节点输入摘要，不要在 runner 内重复写日志。

辅助函数放在 `src/routes/api.ts` 文件底部：

```ts
function nodeInputsForLog(flow: { nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>; edges: Array<{ from: string; to: string }> }, nodeId: string) {
  const upstreamIds = flow.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
  const upstreamNodes = upstreamIds
    .map((id) => flow.nodes.find((node) => node.id === id))
    .filter((node): node is { id: string; type: string; data: Record<string, unknown> } => Boolean(node));
  return {
    upstreamNodeIds: upstreamIds,
    upstreamNodes: upstreamNodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
    node: flow.nodes.find((node) => node.id === nodeId)
  };
}
```

- [ ] **Step 2: 聚合事件加入 canvas/run 字段**

在 `logEvent` 聚合调用中加入：

```ts
canvas_id: savedCanvas.canvasId,
canvas_snapshot_path: canvasPath(savedCanvas.canvasId),
target_node_id: input.targetNodeId,
run_id: runRecord.runId,
```

需要从 `../services/canvases` 引入 `canvasPath`。

- [ ] **Step 3: 为每个执行节点写节点级事件**

在聚合事件之后追加：

```ts
for (const node of result.nodes) {
  await logEvent({
    ...createBaseEvent({
      sessionId: session.sessionId,
      action: "flow_execute",
      model: typeof node.data?.model === "string" ? node.data.model : "local",
      prompt: typeof node.data?.prompt === "string" ? node.data.prompt : "execute_node",
      params: {
        canvasId: savedCanvas.canvasId,
        runId: runRecord.runId,
        nodeId: node.nodeId,
        attempts: node.attempts
      },
      inputAssets: node.inputAssetIds ?? []
    }),
    canvas_id: savedCanvas.canvasId,
    canvas_snapshot_path: canvasPath(savedCanvas.canvasId),
    target_node_id: input.targetNodeId,
    run_id: runRecord.runId,
    flow_id: flowId,
    flow_structure: {
      nodes: input.flow.nodes.map((item) => `${item.id}:${item.type}`),
      edges: input.flow.edges.map((edge) => ({ from: edge.from, to: edge.to }))
    },
    node_id: node.nodeId,
    node_type: node.nodeType,
    node_status: node.status,
    retry_attempt: node.attempts,
    max_retries: 3,
    node_latency_ms: node.latencyMs,
    node_inputs: nodeInputsForLog(input.flow, node.nodeId),
    output_assets: (node.outputAssets ?? []).map((asset) => asset.url),
    status: node.status === "failed" ? "failed" : "success",
    latency_ms: node.latencyMs,
    error_message: node.errorMessage
  });
}
```

- [ ] **Step 4: 确保失败响应也写入聚合事件**

当前 `res.status(result.ok ? 200 : 500)` 已保留 result。确认失败时也执行聚合与节点级日志，不提前 return。

- [ ] **Step 5: 运行测试**

Run:

```powershell
npm.cmd test -- src/logger.test.ts src/phase-one-closure.test.ts
```

Expected: PASS。

---

## Task 4: 增加图片导入客户端和导入面板

**Files:**
- Modify: `web/src/api/client.ts`
- Create: `web/src/canvas/importImages.ts`
- Create: `web/src/canvas/importImages.test.ts`
- Create: `web/src/panels/AssetImportPanel.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: 写导入过滤测试**

创建 `web/src/canvas/importImages.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { imageFilesFromList } from "./importImages";

describe("imageFilesFromList", () => {
  it("keeps only jpg and png files", () => {
    const files = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
      new File(["c"], "c.txt", { type: "text/plain" })
    ];

    expect(imageFilesFromList(files).map((file) => file.name)).toEqual(["a.png", "b.jpg"]);
  });
});
```

- [ ] **Step 2: 实现导入过滤工具**

创建 `web/src/canvas/importImages.ts`：

```ts
export function imageFilesFromList(files: Iterable<File>): File[] {
  return [...files].filter((file) => file.type === "image/png" || file.type === "image/jpeg");
}

export function imageFilesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind !== "file") {
      continue;
    }
    const file = item.getAsFile();
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      files.push(file);
    }
  }
  return files;
}
```

- [ ] **Step 3: 在 API client 增加 `uploadImage`**

在 `web/src/api/client.ts` 加入：

```ts
export type UploadedAsset = {
  assetId: string;
  kind: string;
  path: string;
  publicUrl: string;
  mime: string;
  size: number;
  createdAt: string;
};

export async function uploadImage(file: File, sessionId?: string, roleTag = "素材"): Promise<{ sessionId: string; asset: UploadedAsset }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "base");
  form.append("roleTag", roleTag);
  if (sessionId) {
    form.append("sessionId", sessionId);
  }

  const response = await fetch("/api/upload", {
    method: "POST",
    body: form
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "图片上传失败");
  }
  return json.data as { sessionId: string; asset: UploadedAsset };
}
```

- [ ] **Step 4: 创建导入面板**

创建 `web/src/panels/AssetImportPanel.tsx`：

```tsx
import { Upload } from "lucide-react";

export function AssetImportPanel({ disabled, onFiles }: { disabled?: boolean; onFiles: (files: File[]) => void }) {
  return (
    <section className="asset-import-panel">
      <div className="panel-title-row">
        <h2 className="panel-heading">本地素材</h2>
      </div>
      <label className={`asset-import-drop ${disabled ? "disabled" : ""}`}>
        <Upload aria-hidden="true" />
        <span>选择图片</span>
        <small>支持 jpg / png，也可拖拽或粘贴到画布</small>
        <input
          disabled={disabled}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            onFiles(files);
            event.target.value = "";
          }}
        />
      </label>
    </section>
  );
}
```

- [ ] **Step 5: 在 App 接入导入处理**

在 `web/src/App.tsx` 中引入 `uploadImage`、`imageFilesFromList` 和 `AssetImportPanel`。新增 `handleImportFiles`：

```ts
const handleImportFiles = useCallback(
  async (files: File[]) => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }
    const imageFiles = imageFilesFromList(files);
    if (imageFiles.length === 0) {
      setStatus("没有可导入的 jpg/png 图片");
      return;
    }

    let currentSessionId = session?.sessionId;
    for (const file of imageFiles) {
      const uploaded = await uploadImage(file, currentSessionId);
      currentSessionId = uploaded.sessionId;
      addNodeToEditor(
        editor,
        {
          type: "image",
          title: "图片节点",
          data: {
            assetId: uploaded.asset.assetId,
            url: uploaded.asset.publicUrl,
            name: file.name,
            mime: uploaded.asset.mime,
            roleTag: "素材"
          },
          width: 280,
          height: 260
        },
        placementIndexRef.current
      );
      placementIndexRef.current += 1;
    }
    if (currentSessionId && currentSessionId !== session?.sessionId) {
      setSession(await fetchSession(currentSessionId));
    }
    setStatus(`已导入 ${imageFiles.length} 张图片`);
  },
  [editor, session?.sessionId]
);
```

左侧面板中加入：

```tsx
<AssetImportPanel disabled={!editor} onFiles={handleImportFiles} />
```

- [ ] **Step 6: 运行测试**

Run:

```powershell
npm.cmd test -- web/src/canvas/importImages.test.ts
```

Expected: PASS。

---

## Task 5: 注册 tldraw 自定义节点卡片

**Files:**
- Create: `web/src/canvas/TshuabuNodeShapeUtil.tsx`
- Modify: `web/src/canvas/CanvasApp.tsx`
- Modify: `web/src/canvas/shapeUtils.ts`
- Modify: `web/src/canvas/shapeUtils.test.ts`
- Modify: `web/styles.css`

- [ ] **Step 1: 修改 shape 创建策略测试**

在 `web/src/canvas/shapeUtils.test.ts` 中新增断言，期望节点 shape 类型为 `tshuabu-node`：

```ts
it("creates custom Tshuabu node shapes", () => {
  const shape = createNodeShape({ type: "prompt", title: "Prompt", data: { text: "hello" } }, 10, 20);

  expect(shape.type).toBe("tshuabu-node");
  expect(shape.meta).toMatchObject({
    kind: "tshuabu-node",
    nodeType: "prompt",
    title: "Prompt"
  });
});
```

- [ ] **Step 2: 创建自定义 shape util**

创建 `web/src/canvas/TshuabuNodeShapeUtil.tsx`。实现要点：

```tsx
import { HTMLContainer, Rectangle2d, ShapeUtil, type TLBaseShape } from "tldraw";
import type { CanvasNodeKind, CanvasNodeStatus } from "./flowTypes";

export type TshuabuNodeShape = TLBaseShape<
  "tshuabu-node",
  {
    w: number;
    h: number;
  }
> & {
  meta: {
    kind: "tshuabu-node";
    nodeType: CanvasNodeKind;
    title: string;
    data: Record<string, unknown>;
    status?: CanvasNodeStatus;
  };
};

export class TshuabuNodeShapeUtil extends ShapeUtil<TshuabuNodeShape> {
  static override type = "tshuabu-node" as const;

  override getDefaultProps(): TshuabuNodeShape["props"] {
    return { w: 280, h: 180 };
  }

  override getGeometry(shape: TshuabuNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override component(shape: TshuabuNodeShape) {
    const meta = shape.meta;
    return (
      <HTMLContainer className={`tshuabu-node-card ${meta.nodeType} ${meta.status ?? "idle"}`}>
        <div className="tshuabu-node-head">
          <span>{meta.title}</span>
          <strong>{meta.status ?? "idle"}</strong>
        </div>
        <NodeBody nodeType={meta.nodeType} data={meta.data} status={meta.status} />
      </HTMLContainer>
    );
  }

  override indicator(shape: TshuabuNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={18} ry={18} />;
  }
}
```

同文件中实现 `NodeBody`，至少覆盖 image/prompt/API/output：

```tsx
function NodeBody({ nodeType, data, status }: { nodeType: CanvasNodeKind; data: Record<string, unknown>; status?: CanvasNodeStatus }) {
  if (nodeType === "image") {
    const url = typeof data.url === "string" ? data.url : "";
    return <div className="tshuabu-node-body">{url ? <img className="node-thumb" src={url} alt="素材" /> : <div className="node-empty">拖入图片</div>}</div>;
  }
  if (nodeType === "prompt") {
    return <div className="tshuabu-node-body prompt-preview">{String(data.text ?? "输入提示词")}</div>;
  }
  if (nodeType === "output") {
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    return (
      <div className="tshuabu-node-body output-preview-grid">
        {outputs.map((item) => {
          const output = item as { assetId?: string; url?: string };
          return output.url ? <img key={output.assetId ?? output.url} src={output.url} alt="输出" /> : null;
        })}
        {outputs.length === 0 ? <div className="node-empty">等待输出</div> : null}
      </div>
    );
  }
  return (
    <div className="tshuabu-node-body api-preview">
      <span>{String(data.model ?? "选择模型")}</span>
      <small>{status === "failed" ? String(data.errorMessage ?? "执行失败") : String(data.prompt ?? "连接 Prompt 或填写覆盖提示词")}</small>
    </div>
  );
}
```

- [ ] **Step 3: 修改 `shapeUtils.createNodeShape`**

将返回类型从 `TLGeoShape` 改为自定义 shape partial：

```ts
return {
  id: id ?? createShapeId(),
  type: "tshuabu-node",
  x,
  y,
  meta,
  props: {
    w: width,
    h: height
  }
};
```

保留 `isTshuabuNodeMeta`、`mergeNodeData`、恢复快照逻辑。

- [ ] **Step 4: 在 CanvasApp 注册 shape**

修改 `web/src/canvas/CanvasApp.tsx`：

```tsx
import { Tldraw, type Editor } from "tldraw";
import { TshuabuNodeShapeUtil } from "./TshuabuNodeShapeUtil";

const shapeUtils = [TshuabuNodeShapeUtil];

export function CanvasApp({ onMount, onFiles }: { onMount?: (editor: Editor) => void; onFiles?: (files: File[]) => void }) {
  return (
    <div className="tldraw-host">
      <Tldraw persistenceKey="tshuabu-phase-one-canvas" onMount={onMount} shapeUtils={shapeUtils} />
    </div>
  );
}
```

- [ ] **Step 5: 添加节点卡片样式**

在 `web/styles.css` 中加入：

```css
.tshuabu-node-card {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  color: #e5e9f0;
  background: #171d29;
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
}

.tshuabu-node-head {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.tshuabu-node-head span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 800;
}

.tshuabu-node-head strong {
  border-radius: 6px;
  padding: 2px 7px;
  background: rgba(148, 163, 184, 0.16);
  color: #9aa6b8;
  font-size: 10px;
}

.tshuabu-node-card.running .tshuabu-node-head strong {
  background: rgba(59, 130, 246, 0.22);
  color: #93c5fd;
}

.tshuabu-node-card.failed .tshuabu-node-head strong {
  background: rgba(239, 68, 68, 0.22);
  color: #fca5a5;
}

.tshuabu-node-body {
  height: calc(100% - 42px);
  padding: 12px;
  overflow: auto;
}

.node-thumb,
.output-preview-grid img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: #0f141d;
}

.node-empty {
  height: 100%;
  min-height: 96px;
  display: grid;
  place-items: center;
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  color: #8f9aab;
}

.output-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}
```

- [ ] **Step 6: 运行测试**

Run:

```powershell
npm.cmd test -- web/src/canvas/shapeUtils.test.ts web/src/canvas/flowCompiler.test.ts
```

Expected: PASS。

---

## Task 6: 拖拽和粘贴导入到画布

**Files:**
- Modify: `web/src/canvas/CanvasApp.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/canvas/importImages.ts`

- [ ] **Step 1: 扩展 CanvasApp props**

让 `CanvasApp` 接收 `onFiles`：

```tsx
export function CanvasApp({
  onMount,
  onFiles
}: {
  onMount?: (editor: Editor) => void;
  onFiles?: (files: File[]) => void;
}) {
  return (
    <div
      className="tldraw-host"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const files = imageFilesFromList(event.dataTransfer.files);
        if (files.length > 0) {
          event.preventDefault();
          onFiles?.(files);
        }
      }}
      onPaste={(event) => {
        const files = imageFilesFromClipboard(event.clipboardData.items);
        if (files.length > 0) {
          event.preventDefault();
          onFiles?.(files);
        }
      }}
    >
      <Tldraw persistenceKey="tshuabu-phase-one-canvas" onMount={onMount} shapeUtils={shapeUtils} />
    </div>
  );
}
```

- [ ] **Step 2: App 传入 `handleImportFiles`**

```tsx
<CanvasApp onMount={setEditor} onFiles={handleImportFiles} />
```

- [ ] **Step 3: 增加导入状态提示**

在导入开始和结束时设置状态：

```ts
setStatus(`正在导入 ${imageFiles.length} 张图片`);
...
setStatus(`已导入 ${imageFiles.length} 张图片`);
```

- [ ] **Step 4: 运行测试和构建**

Run:

```powershell
npm.cmd test -- web/src/canvas/importImages.test.ts
npm.cmd run build
```

Expected: 测试 PASS，构建 PASS。

---

## Task 7: 运行状态回写和 Output 节点结果回显

**Files:**
- Modify: `web/src/canvas/shapeUtils.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/canvas/shapeUtils.test.ts`

- [ ] **Step 1: 写 Output 数据合并测试**

在 `shapeUtils.test.ts` 增加纯函数测试。先创建函数 `mergeOutputAssets`：

```ts
it("appends generated assets into output node data", () => {
  expect(
    mergeOutputAssets(
      { outputs: [{ assetId: "old", url: "/outputs/old.png" }] },
      [{ assetId: "new", url: "/outputs/new.png" }]
    )
  ).toEqual({
    outputs: [
      { assetId: "old", url: "/outputs/old.png" },
      { assetId: "new", url: "/outputs/new.png" }
    ]
  });
});
```

- [ ] **Step 2: 实现 Output 合并和节点状态工具**

在 `shapeUtils.ts` 中加入：

```ts
export function mergeOutputAssets(
  data: Record<string, unknown>,
  assets: Array<{ assetId: string; url: string }>
): Record<string, unknown> {
  const existing = Array.isArray(data.outputs) ? data.outputs : [];
  const seen = new Set(existing.map((item) => (isOutputAsset(item) ? item.assetId : "")));
  const next = [...existing];
  for (const asset of assets) {
    if (!seen.has(asset.assetId)) {
      next.push(asset);
      seen.add(asset.assetId);
    }
  }
  return { ...data, outputs: next };
}

function isOutputAsset(value: unknown): value is { assetId: string; url: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { assetId?: unknown }).assetId === "string" &&
      typeof (value as { url?: unknown }).url === "string"
  );
}
```

再加入：

```ts
export function updateNodeStatuses(editor: Editor, nodes: Array<{ nodeId: string; status: CanvasNodeStatus; errorMessage?: string }>): void {
  for (const node of nodes) {
    const shape = editor.getShape(node.nodeId as TLShapeId);
    if (!shape || !isTshuabuNodeMeta(shape.meta)) {
      continue;
    }
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      meta: {
        ...shape.meta,
        status: node.status,
        data: node.errorMessage ? { ...shape.meta.data, errorMessage: node.errorMessage } : shape.meta.data
      }
    });
  }
}
```

- [ ] **Step 3: 实现把输出写入 Output 节点**

在 `shapeUtils.ts` 中加入：

```ts
export function addOutputsToOutputNode(editor: Editor, assets: Array<{ assetId: string; url: string }>): void {
  if (assets.length === 0) {
    return;
  }
  const outputShape = editor.getCurrentPageShapes().find((shape) => isTshuabuNodeMeta(shape.meta) && shape.meta.nodeType === "output");
  if (!outputShape || !isTshuabuNodeMeta(outputShape.meta)) {
    return;
  }
  editor.updateShape({
    id: outputShape.id,
    type: outputShape.type,
    meta: {
      ...outputShape.meta,
      status: "success",
      data: mergeOutputAssets(outputShape.meta.data, assets)
    }
  });
  editor.select(outputShape.id);
}
```

- [ ] **Step 4: App 中替换 loose image 输出行为**

在 `web/src/App.tsx` 中，运行成功后使用：

```ts
updateNodeStatuses(editor, result.nodes.map((node) => ({
  nodeId: node.nodeId,
  status: node.status as CanvasNodeStatus,
  errorMessage: node.errorMessage
})));
addOutputsToOutputNode(editor, result.outputAssets);
```

暂时移除或降级 `addOutputImagesToEditor(editor, result.outputAssets)`，验收路径不再散放图片。

- [ ] **Step 5: 没有 Output 节点时自动创建**

在 `handleRun` 编译前检查：

```ts
const hasOutputNode = editor.getCurrentPageShapes().some(
  (shape) => isTshuabuNodeMeta(shape.meta) && shape.meta.nodeType === "output"
);
if (!hasOutputNode) {
  addNodeToEditor(editor, { type: "output", title: "Output", data: {}, width: 460, height: 260 }, placementIndexRef.current);
  placementIndexRef.current += 1;
}
```

- [ ] **Step 6: 运行测试**

Run:

```powershell
npm.cmd test -- web/src/canvas/shapeUtils.test.ts
```

Expected: PASS。

---

## Task 8: 视觉外壳对齐案例项目

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/panels/NodePalette.tsx`
- Modify: `web/src/panels/RunPanel.tsx`
- Modify: `web/src/panels/CanvasPersistenceBar.tsx`
- Modify: `web/styles.css`

- [ ] **Step 1: 调整 App 布局结构**

把主结构改成案例式 shell：

```tsx
<main className="app-shell visual-shell">
  <aside className="floating-panel left-material-panel" aria-label="素材面板">
    <AssetImportPanel disabled={!editor} onFiles={handleImportFiles} />
    <NodePalette disabled={!editor} onAddNode={handleAddNode} onConnectMode={handleConnectMode} />
  </aside>
  <section className="workspace" aria-label="画布">
    <div className="project-pill">未命名项目</div>
    <CanvasApp onMount={setEditor} onFiles={handleImportFiles} />
    <RunPanel onRun={handleRun} status={status} nodeCount={lastRunNodes.length} />
  </section>
  <aside className="floating-panel right-control-panel" aria-label="控制面板">
    <ApiSettings providers={providers} onProvidersChange={setProviders} />
    <CanvasPersistenceBar canvasId={canvasId} savedAt={savedAt} onLoad={handleLoadCanvas} onSave={handleSaveCanvas} />
    <RunHistory session={session} />
  </aside>
</main>
```

- [ ] **Step 2: 设置深色点阵背景**

替换 `web/styles.css` 中 body/app/workspace 背景：

```css
body {
  overflow: hidden;
  font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
  color: #e5e9f0;
  background: #0f141d;
}

.app-shell.visual-shell {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  background-color: #0f141d;
  background-image: radial-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px);
  background-size: 24px 24px;
}

.workspace {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
  background: transparent;
}
```

- [ ] **Step 3: 设置浮动面板**

```css
.floating-panel {
  position: absolute;
  z-index: 20;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  background: rgba(17, 23, 34, 0.86);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
}

.left-material-panel {
  left: 16px;
  top: 16px;
  bottom: 16px;
  width: 340px;
  overflow: auto;
  padding: 14px;
}

.right-control-panel {
  right: 16px;
  top: 64px;
  bottom: 16px;
  width: 360px;
  overflow: auto;
  padding: 14px;
}

.project-pill {
  position: absolute;
  top: 16px;
  left: 50%;
  z-index: 25;
  transform: translateX(-50%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 999px;
  padding: 9px 18px;
  color: #e5e9f0;
  background: rgba(17, 23, 34, 0.82);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  font-weight: 800;
}
```

- [ ] **Step 4: 调整表单和按钮颜色**

将 `.mini-button`、`.field-control`、`.node-button` 改为深色面板内样式：

```css
.mini-button,
.node-button,
.field-control {
  border-color: rgba(148, 163, 184, 0.18);
  color: #d8dee9;
  background: #111722;
}

.mini-button:hover,
.node-button:hover {
  border-color: #566174;
  background: #171d29;
}

.mini-button.dark,
.primary-button {
  color: #10141d;
  background: #d8dee9;
}
```

- [ ] **Step 5: 运行构建**

Run:

```powershell
npm.cmd run build
```

Expected: PASS。

---

## Task 9: 导出当前选中 Output 结果

**Files:**
- Modify: `web/src/canvas/shapeUtils.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/panels/CanvasPersistenceBar.tsx`

- [ ] **Step 1: 增加选中输出查询函数**

在 `shapeUtils.ts` 加入：

```ts
export function selectedOutputAsset(editor: Editor): { assetId: string; url: string } | undefined {
  const selected = editor.getSelectedShapeIds()
    .map((id) => editor.getShape(id))
    .find((shape) => isTshuabuNodeMeta(shape?.meta) && shape.meta.nodeType === "output");
  if (!selected || !isTshuabuNodeMeta(selected.meta)) {
    return undefined;
  }
  const outputs = Array.isArray(selected.meta.data.outputs) ? selected.meta.data.outputs : [];
  const last = outputs[outputs.length - 1];
  return isOutputAsset(last) ? last : undefined;
}
```

如果 `isOutputAsset` 是内部函数，需要导出或改为同文件可复用。

- [ ] **Step 2: App 实现导出 handler**

```ts
const handleExportSelected = useCallback(() => {
  if (!editor) {
    setStatus("画布还在加载");
    return;
  }
  const asset = selectedOutputAsset(editor);
  if (!asset) {
    setStatus("请先选择带结果的 Output 节点");
    return;
  }
  const link = document.createElement("a");
  link.href = asset.url;
  link.download = `${asset.assetId}.png`;
  link.click();
  setStatus(`已导出 ${asset.assetId}`);
}, [editor]);
```

- [ ] **Step 3: 在画布面板加入导出按钮**

`CanvasPersistenceBar` 增加 prop：

```ts
onExport: () => void;
```

按钮：

```tsx
<button className="mini-button" onClick={onExport} type="button">
  导出选中结果
</button>
```

- [ ] **Step 4: 运行构建**

Run:

```powershell
npm.cmd run build
```

Expected: PASS。

---

## Task 10: 最终验收和回归

**Files:**
- Verify only

- [ ] **Step 1: 运行全部测试**

Run:

```powershell
npm.cmd test -- --run
```

Expected: 所有测试 PASS。

- [ ] **Step 2: 运行生产构建**

Run:

```powershell
npm.cmd run build
```

Expected: TypeScript 和 Vite 构建 PASS。允许保留 tldraw 造成的大 chunk warning，但不能有 error。

- [ ] **Step 3: 启动后端和前端**

Run:

```powershell
npm.cmd run dev -- serve:web
npm.cmd run dev:web
```

Expected:

- 后端监听 `http://localhost:8787`。
- 前端监听 `http://127.0.0.1:5173`。

- [ ] **Step 4: 手动验收主路径**

在浏览器中执行：

1. 从左侧素材面板导入一张 png 或 jpg。
2. 确认画布出现 image 节点并显示缩略图。
3. 创建 prompt 节点，填写提示词。
4. 创建 `api_img2img` 或 `api_text2img` 节点。
5. 创建 Output 节点。
6. 用箭头连接 prompt -> API -> Output，若是 img2img 再连接 image -> API。
7. 点击运行。

Expected:

- 运行状态显示进行中。
- 成功后 Output 节点显示结果缩略图。
- `logs/canvases/<canvasId>.json` 存在。
- `logs/sessions/<sessionId>.json` 中有 run 和 version。
- `logs/rag_events.jsonl` 有 `canvas_id`、`run_id`、`node_id`、`node_inputs`、`output_assets`。

- [ ] **Step 5: 手动验收失败路径**

临时使用错误模型或无效 API key 运行一次。

Expected:

- API 节点状态为 `failed`。
- 节点卡片显示错误摘要。
- 流程停止。
- RAG 日志记录失败事件和尝试次数。

- [ ] **Step 6: 最终状态检查**

Run:

```powershell
git status --short
```

Expected: 只包含本次代码、测试、文档改动；日志、outputs、references 等已有未跟踪文件不要混入提交。

---

## 计划自检

- 规格覆盖：覆盖图片导入、节点运行、自动保存、Output 回显、session/run/version、RAG 字段、失败反馈、导出、视觉对齐和测试构建。
- 占位符检查：没有未定事项或空白 TODO；每个任务都有明确文件、代码方向、命令和预期结果。
- 类型一致性：`CanvasSnapshot`、`FlowSnapshot`、`NodeExecutionResult`、`RagEvent`、Output 数据结构在前后端保持同名字段。
- 范围控制：不实现 ComfyUI、LLM、Loop、Video 的完整能力，只保留第一阶段必要入口和验收路径。
