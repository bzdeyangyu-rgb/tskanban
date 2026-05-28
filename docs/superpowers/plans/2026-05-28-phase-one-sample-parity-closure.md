# Phase One Sample Parity Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring phase-one canvas and feature UI to a testable production baseline against the Infinite-Canvas reference while honoring our current product decisions: no ModelScope requirement, no ComfyUI requirement, and MS generation replaced by Gene Library.

**Architecture:** Keep the current React + custom DOM/SVG canvas core, but harden it into reference-style product behavior: stable canvas persistence, real image-reference API routing, in-canvas image editing, executable workflow nodes, and unified visual primitives. Backend additions stay inside the existing Express route/service structure so the desktop app remains simple to run and test.

**Tech Stack:** React, TypeScript, Vite, Express, Vitest, Playwright, local JSONL/RAG logging, current image provider adapter layer.

---

## Scope Boundary

This plan treats the sample project as the visual and interaction reference, not as a feature mandate for every vendor integration.

**Included in phase-one parity:**
- Reference-style dark product shell, sidebar, bottom settings, canvas gate, node toolbar, nodes, edges, menus, output, logs.
- Real text-to-image, image-to-image, and inpaint/brush edit flow through our API provider layer.
- Canvas save/load/restore, autosave status, local fallback draft, and visible recovery.
- Prompt, image, API generation, loop, LLM, output, group, log, and gene library workflow behaviors.
- API provider settings: fetch models, test connection, protocol detection, and model save.
- RAG/session logging that records workflow structure, node outputs, latency, failures, retries, and relevant image-edit metadata.

**Excluded by product decision for now:**
- ComfyUI execution and custom ComfyUI workflow management.
- ModelScope-specific MS generation and LoRA management.
- Bundled Python installer and Mac packaging work.

---

## Current Gap Summary

### P0: Blocking First-Phase Production Gaps

1. Canvas visual system is not yet reference-grade across sidebar, settings, toolbar, nodes, menus, modals, and feature pages.
2. Image edit is only an entrypoint; brush mask/inpaint canvas is missing.
3. Img2img must be verified so reference images are passed as image inputs, not converted to plain text prompt flow.
4. Loop node is visually present but not a true repeat/concurrency executor.
5. LLM node is not a real API-backed workflow node with image input.
6. Save/load exists, but visible save status, recovery, and trash/restore are incomplete.
7. Retry/error classification exists only partially and does not match the API-only retry requirement.

### P1: Important Sample-Parity Gaps

1. Link creation menu, link removal, cut/disconnect affordances, and hover hit areas need to match the sample interaction model.
2. Node internals need reference-grade layout, hidden scrollbars, resize handle behavior, and image drop zones.
3. Feature pages need complete panels, not shell-only views.
4. API settings panel needs sample-level provider/model/protocol feedback.
5. Run history, output lightbox, export, and version management are not mature.
6. Chinese/dark-mode toggles need actual state changes and full copy cleanup.
7. Legacy UI/code paths need cleanup once the new canvas is stable.

---

## File Structure

### Canvas Core

- Modify: `web/src/canvas/ReferenceCanvas.tsx`
  - Owns canvas state, pan/zoom, selection, node rendering, edge rendering, menus, node execution entrypoints, autosave hooks, and keyboard shortcuts.
- Create: `web/src/canvas/canvasTypes.ts`
  - Shared node, edge, viewport, selection, workflow, and execution type definitions.
- Create: `web/src/canvas/canvasPersistence.ts`
  - Client-side save/load/autosave/recovery helpers.
- Create: `web/src/canvas/canvasGraph.ts`
  - Pure graph helpers: connected assets, upstream prompt resolution, executable order, edge disconnect, selected subgraph export.
- Create: `web/src/canvas/nodeRegistry.tsx`
  - Node metadata, display labels, icons, ports, default data, and renderer mapping.
- Create: `web/src/canvas/nodeRenderers.tsx`
  - Reference-style node interiors for image, prompt, API, img2img, inpaint, loop, LLM, output, group, log, and gene nodes.
- Create: `web/src/canvas/edgeInteractions.ts`
  - Pointer geometry, Bezier path generation, hover hit test, link menu placement, and knife/cut behavior.
- Create: `web/src/canvas/imageEdit.ts`
  - Browser mask drawing helpers, mask export, crop bounds, and inpaint payload preparation.

### UI System

- Modify: `web/src/styles.css`
  - Global design tokens, product shell, sidebar, toolbars, modals, nodes, command menus, feature pages, dark/light themes.
- Create: `web/src/ui/ProductShell.tsx`
  - Reference-style sidebar, bottom settings, branding, language/theme/API settings entrypoints.
- Create: `web/src/ui/ReferenceButton.tsx`
  - Shared pill/icon button variants used by sidebar, toolbar, modals, and node menus.
- Create: `web/src/ui/ReferenceModal.tsx`
  - Shared modal shell for canvas picker, API settings, history, gene library, and image edit.
- Create: `web/src/ui/Tooltip.tsx`
  - Non-garbled Chinese tooltips with consistent placement.

### Feature Pages

- Modify: `web/src/App.tsx`
  - Route shell to `ProductShell`, feature pages, canvas, API settings, and settings modals.
- Create: `web/src/pages/TextToImagePage.tsx`
  - Text-to-image page with size, batch, provider/model, prompt templates, preview, and history.
- Create: `web/src/pages/EnhancePage.tsx`
  - Detail enhance page with input image, strength, preview, run, and management panel.
- Create: `web/src/pages/ImageEditPage.tsx`
  - Image edit page with input/reference, prompt, brush mask preview, run, and output management.
- Create: `web/src/pages/AngleControlPage.tsx`
  - Angle control page with input image, camera controls, prompt, preview, and output panel.
- Create: `web/src/pages/OnlineImagePage.tsx`
  - Online image API page with provider/model, prompt, size, preview, and history.
- Create: `web/src/pages/GptChatPage.tsx`
  - API-backed chat page with image attachment, prompt improvement, and conversation history.

### Backend Services

- Modify: `src/routes/api.ts`
  - Add or harden endpoints for protocol probe, canvas trash/restore, image edit mask upload, workflow execution logs, and history queries.
- Modify: `src/imageApi.ts`
  - Verify and normalize text2img/img2img/inpaint/video provider payloads.
- Modify: `src/services/canvases.ts`
  - Add trash/restore metadata, autosave version fields, and recovery metadata.
- Modify: `src/services/providers.ts`
  - Add protocol probe result storage and provider capability normalization.
- Modify: `src/logger.ts`
  - Add node-level run records, retry classification, image edit metadata, and cost/usage placeholders from provider response fields when present.
- Create: `src/services/workflowExecutor.ts`
  - Server/client-safe pure workflow execution planning helpers used by route tests and canvas tests.

### Tests

- Modify/Create: `tests/canvasPersistence.test.ts`
- Modify/Create: `tests/canvasGraph.test.ts`
- Modify/Create: `tests/imageApi.test.ts`
- Modify/Create: `tests/workflowExecutor.test.ts`
- Modify/Create: `tests/providerProtocol.test.ts`
- Create: `web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx`
- Create: `web/src/pages/__tests__/featurePages.test.tsx`
- Create: `tests/e2e/canvas-parity.spec.ts`

---

## Milestone 0: Baseline Audit and Visual Snapshot

### Task 0.1: Capture Current UI Baseline

**Files:**
- Create: `docs/frontend-reports/2026-05-28-phase-one-current-ui-audit.md`
- Create: `docs/frontend-reports/screenshots/2026-05-28/`

- [ ] **Step 1: Start the app**

Run:

```powershell
npm run dev
```

Expected: Vite app is reachable at the printed localhost URL.

- [ ] **Step 2: Capture screenshots with Browser/Playwright**

Capture these states:

```text
/                 product shell default
/canvas           canvas picker and opened canvas
/text-to-image    text-to-image page
/enhance          detail enhance page
/image-edit       image edit page
/angle            angle control page
/online           online image page
/gpt-chat         GPT chat page
```

Expected: screenshots saved under `docs/frontend-reports/screenshots/2026-05-28/`.

- [ ] **Step 3: Write the audit report**

Report sections:

```markdown
# Phase One Current UI Audit

## Reference Target
- Dark product shell.
- Left feature navigation.
- Bottom theme/language/API/settings controls.
- Center canvas gate and infinite canvas.
- Reference-style node toolbar, nodes, ports, links, command menus.

## Current Deviations
| Area | Current | Reference | Severity |
|---|---|---|---|

## Functional Deviations Seen In UI
| Flow | Current | Expected | Severity |
|---|---|---|---|

## Screenshots
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/frontend-reports/2026-05-28-phase-one-current-ui-audit.md docs/frontend-reports/screenshots/2026-05-28
git commit -m "docs: capture phase one ui parity baseline"
```

Expected: Commit succeeds.

---

## Milestone 1: Unified Reference Visual System

### Task 1.1: Extract Product Shell and Shared UI Primitives

**Files:**
- Create: `web/src/ui/ProductShell.tsx`
- Create: `web/src/ui/ReferenceButton.tsx`
- Create: `web/src/ui/ReferenceModal.tsx`
- Create: `web/src/ui/Tooltip.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/pages/__tests__/featurePages.test.tsx`

- [ ] **Step 1: Write shell render test**

Create test assertions:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

describe('product shell', () => {
  it('renders the reference navigation labels and bottom controls in Chinese', () => {
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

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
```

Expected: FAIL because the new shell/primitives are not yet implemented.

- [ ] **Step 3: Implement shared shell**

Implementation rules:

```text
Sidebar expanded width: 326px.
Sidebar collapsed width: 64px.
Navigation icon button visual center must align with the circle center.
Bottom controls use the same visual scale as top navigation.
Brand text must be Side.
No DX text may remain visible.
No mojibake text may appear in labels or title attributes.
```

- [ ] **Step 4: Add design tokens**

Add CSS variables:

```css
:root {
  --side-bg: #0b111b;
  --side-panel: #101827;
  --side-panel-2: #151e2e;
  --side-border: rgba(148, 163, 184, 0.18);
  --side-text: #e8eef8;
  --side-muted: #95a4bc;
  --side-accent: #dfe7f4;
  --side-danger: #f47272;
  --side-radius-pill: 999px;
  --side-radius-card: 18px;
  --side-shadow: 0 18px 60px rgba(0, 0, 0, 0.36);
}
```

- [ ] **Step 5: Run test and visual smoke**

Run:

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm run build
```

Expected: Tests pass and build succeeds.

- [ ] **Step 6: Commit**

Run:

```powershell
git add web/src/ui web/src/App.tsx web/src/styles.css web/src/pages/__tests__/featurePages.test.tsx
git commit -m "feat: unify reference product shell"
```

Expected: Commit succeeds.

---

## Milestone 2: Canvas Persistence and Recovery

### Task 2.1: Add Visible Autosave, Trash, Restore, and Recovery

**Files:**
- Create: `web/src/canvas/canvasPersistence.ts`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `src/services/canvases.ts`
- Modify: `src/routes/api.ts`
- Test: `tests/canvasPersistence.test.ts`

- [ ] **Step 1: Write persistence tests**

Test cases:

```ts
import { describe, expect, it } from 'vitest';
import { markCanvasDeleted, restoreCanvasRecord } from '../src/services/canvases';

describe('canvas persistence', () => {
  it('marks a canvas as deleted without removing its data', async () => {
    const record = await markCanvasDeleted('test-canvas-id');
    expect(record.deletedAt).toEqual(expect.any(String));
    expect(record.nodes).toBeDefined();
  });

  it('restores a deleted canvas by clearing deletedAt', async () => {
    const record = await restoreCanvasRecord('test-canvas-id');
    expect(record.deletedAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/canvasPersistence.test.ts
```

Expected: FAIL because `markCanvasDeleted` and `restoreCanvasRecord` are not available or incomplete.

- [ ] **Step 3: Implement backend trash/restore**

Required behavior:

```text
DELETE /api/canvases/:id marks deletedAt and keeps the file.
POST /api/canvases/:id/restore clears deletedAt.
GET /api/canvases?includeDeleted=true returns active and deleted records.
GET /api/canvases returns active records only.
```

- [ ] **Step 4: Implement client save status**

Canvas UI states:

```text
已保存
正在保存
离线草稿已保存
保存失败，已保留本地草稿
发现本地草稿，点击恢复
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm test -- tests/canvasPersistence.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

Run:

```powershell
git add web/src/canvas/canvasPersistence.ts web/src/canvas/ReferenceCanvas.tsx src/services/canvases.ts src/routes/api.ts tests/canvasPersistence.test.ts
git commit -m "feat: add canvas recovery and autosave status"
```

Expected: Commit succeeds.

---

## Milestone 3: Reference-Grade Canvas UI

### Task 3.1: Split Node Registry and Node Renderers

**Files:**
- Create: `web/src/canvas/canvasTypes.ts`
- Create: `web/src/canvas/nodeRegistry.tsx`
- Create: `web/src/canvas/nodeRenderers.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx`

- [ ] **Step 1: Write renderer test**

Assertions:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderCanvasNode } from '../nodeRenderers';

describe('node renderers', () => {
  it('renders prompt node with character count and output port', () => {
    render(renderCanvasNode({
      id: 'prompt-1',
      type: 'prompt',
      x: 0,
      y: 0,
      width: 320,
      height: 220,
      data: { prompt: '测试提示词' },
    }));

    expect(screen.getByText('提示词')).toBeTruthy();
    expect(screen.getByText('4 字')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
```

Expected: FAIL until renderers are extracted.

- [ ] **Step 3: Implement node registry**

Required node definitions:

```text
image: 图片
prompt: 提示词
loop: 循环
llm: LLM
api: API生成
video: 视频生成
output: Output
group: 分组
log: 日志
gene: 基因库
inpaint: 图片编辑
enhance: 细节增强
angle: 角度控制
```

- [ ] **Step 4: Implement reference-style node shell**

Node shell rules:

```text
Title bar: icon + Chinese label + compact actions.
Ports: clear left/right or bottom-right positions depending node type.
Content: no native scrollbar visible.
Resize: internal corner/triangle handle, not an external debug frame.
Image drop zone: clickable and droppable.
Selected: subtle bright border, no layout shift.
Running: pulse/status chip.
Failed: red status chip and retry action.
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm test -- web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

Run:

```powershell
git add web/src/canvas/canvasTypes.ts web/src/canvas/nodeRegistry.tsx web/src/canvas/nodeRenderers.tsx web/src/canvas/ReferenceCanvas.tsx web/src/styles.css web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
git commit -m "feat: add reference canvas node renderers"
```

Expected: Commit succeeds.

### Task 3.2: Complete Edge, Disconnect, and Command Menu Interactions

**Files:**
- Create: `web/src/canvas/edgeInteractions.ts`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/styles.css`
- Test: `tests/canvasGraph.test.ts`
- Test: `web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx`

- [ ] **Step 1: Write graph helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { disconnectEdge, createLinkedNodePlan } from '../web/src/canvas/canvasGraph';

describe('canvas graph interactions', () => {
  it('disconnects an edge by id', () => {
    const edges = [{ id: 'e1', from: 'a', to: 'b' }];
    expect(disconnectEdge(edges, 'e1')).toEqual([]);
  });

  it('creates a linked child node plan from an output port', () => {
    const plan = createLinkedNodePlan({
      sourceNodeId: 'prompt-1',
      sourcePort: 'out',
      nodeType: 'api',
      x: 480,
      y: 220,
    });

    expect(plan.node.type).toBe('api');
    expect(plan.edge.from).toBe('prompt-1');
    expect(plan.edge.to).toBe(plan.node.id);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/canvasGraph.test.ts
```

Expected: FAIL until helpers exist.

- [ ] **Step 3: Implement edge interactions**

Required interaction states:

```text
Drag from port: shows live Bezier preview.
Release on empty canvas: opens command menu near cursor.
Release on compatible port: creates edge.
Hover edge: shows compact delete/disconnect button.
Click disconnect: removes edge immediately.
Shift-drag cut line: removes every edge intersecting the cut path.
Escape while dragging: cancels link creation.
```

- [ ] **Step 4: Add Chinese command menu**

Menu labels:

```text
连接到图片
连接到提示词
连接到循环
连接到 LLM
连接到 API生成
连接到视频生成
连接到 Output
连接到分组
断开连线
取消
```

- [ ] **Step 5: Run tests and e2e smoke**

Run:

```powershell
npm test -- tests/canvasGraph.test.ts web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

Run:

```powershell
git add web/src/canvas/edgeInteractions.ts web/src/canvas/ReferenceCanvas.tsx web/src/styles.css tests/canvasGraph.test.ts web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
git commit -m "feat: complete canvas link and disconnect interactions"
```

Expected: Commit succeeds.

---

## Milestone 4: Image Reference, Img2img, and Inpaint Truth

### Task 4.1: Verify Provider Payloads for Text2img, Img2img, and Inpaint

**Files:**
- Modify: `src/imageApi.ts`
- Modify: `src/flows/runners/api.ts`
- Test: `tests/imageApi.test.ts`

- [ ] **Step 1: Write payload normalization tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildImageRequestPayload } from '../src/imageApi';

describe('image API payloads', () => {
  it('builds text-to-image payload without reference images', () => {
    const payload = buildImageRequestPayload({
      mode: 'text2img',
      prompt: '未来城市',
      size: '1024x1024',
      inputImages: [],
    });

    expect(payload.prompt).toContain('未来城市');
    expect(payload.images).toBeUndefined();
  });

  it('builds image-to-image payload with reference images', () => {
    const payload = buildImageRequestPayload({
      mode: 'img2img',
      prompt: '保持构图，改成赛博风格',
      size: '1024x1024',
      inputImages: [{ mimeType: 'image/png', dataUrl: 'data:image/png;base64,AAAA' }],
    });

    expect(payload.images?.[0]).toContain('data:image/png;base64,AAAA');
    expect(payload.prompt).toContain('保持构图');
  });

  it('builds inpaint payload with image and mask', () => {
    const payload = buildImageRequestPayload({
      mode: 'inpaint',
      prompt: '替换背景',
      size: '1024x1024',
      inputImages: [{ mimeType: 'image/png', dataUrl: 'data:image/png;base64,IMG' }],
      mask: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,MASK' },
    });

    expect(payload.image).toContain('data:image/png;base64,IMG');
    expect(payload.mask).toContain('data:image/png;base64,MASK');
  });
});
```

- [ ] **Step 2: Run test and verify failure or current behavior**

Run:

```powershell
npm test -- tests/imageApi.test.ts
```

Expected: Tests reveal whether img2img/inpaint payloads are real or only prompt-based.

- [ ] **Step 3: Implement provider payload normalization**

Required behavior:

```text
text2img sends prompt and generation params.
img2img sends prompt plus reference image array.
inpaint sends prompt plus source image plus mask image.
Provider adapters may map field names, but source images must not be dropped.
Every response stores provenance: provider, model, mode, prompt, input asset ids, output asset id, latency.
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm test -- tests/imageApi.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/imageApi.ts src/flows/runners/api.ts tests/imageApi.test.ts
git commit -m "fix: preserve image references in generation payloads"
```

Expected: Commit succeeds.

### Task 4.2: Add Real Brush Mask Image Edit UI

**Files:**
- Create: `web/src/canvas/imageEdit.ts`
- Modify: `web/src/canvas/nodeRenderers.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/pages/ImageEditPage.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx`

- [ ] **Step 1: Write mask export test**

```ts
import { describe, expect, it } from 'vitest';
import { createMaskMetadata } from '../imageEdit';

describe('image edit mask metadata', () => {
  it('records brush strokes and bounds for inpaint logging', () => {
    const metadata = createMaskMetadata({
      width: 1024,
      height: 1024,
      strokes: [{ points: [{ x: 100, y: 120 }, { x: 180, y: 160 }], radius: 24 }],
    });

    expect(metadata.bounds).toEqual({ x: 76, y: 96, width: 128, height: 88 });
    expect(metadata.strokeCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
```

Expected: FAIL until image edit helpers exist.

- [ ] **Step 3: Implement image edit modal**

Required UI:

```text
Source image preview.
Brush size slider.
Erase mask toggle.
Clear mask button.
Prompt field.
Run inpaint button.
Before/after preview.
Save result to canvas button.
```

- [ ] **Step 4: Connect image edit to API node**

Required flow:

```text
Image node -> image edit action -> brush mask -> inpaint request -> output image node.
Prompt node -> inpaint node uses prompt.
Output node can collect edited result.
RAG log records mask bounds and input image asset id.
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm test -- web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx tests/imageApi.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

Run:

```powershell
git add web/src/canvas/imageEdit.ts web/src/canvas/nodeRenderers.tsx web/src/canvas/ReferenceCanvas.tsx web/src/pages/ImageEditPage.tsx web/src/styles.css
git commit -m "feat: add canvas brush mask image editing"
```

Expected: Commit succeeds.

---

## Milestone 5: Executable Workflow Nodes

### Task 5.1: Add Loop Node Execution

**Files:**
- Create: `src/services/workflowExecutor.ts`
- Modify: `web/src/canvas/canvasGraph.ts`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Test: `tests/workflowExecutor.test.ts`

- [ ] **Step 1: Write loop execution test**

```ts
import { describe, expect, it } from 'vitest';
import { expandLoopRuns } from '../src/services/workflowExecutor';

describe('loop node execution', () => {
  it('expands prompts with the current loop index', () => {
    const runs = expandLoopRuns({
      count: 3,
      promptTemplate: '生成第 {{index}} 张卖点图',
    });

    expect(runs.map((run) => run.prompt)).toEqual([
      '生成第 1 张卖点图',
      '生成第 2 张卖点图',
      '生成第 3 张卖点图',
    ]);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/workflowExecutor.test.ts
```

Expected: FAIL until loop execution helpers exist.

- [ ] **Step 3: Implement loop expansion**

Required behavior:

```text
Loop node has count, concurrency, and index template.
Prompt can use {{index}}.
Loop feeds downstream API node N times.
Each output receives run index metadata.
Output node groups repeated results.
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test -- tests/workflowExecutor.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/services/workflowExecutor.ts web/src/canvas/canvasGraph.ts web/src/canvas/ReferenceCanvas.tsx tests/workflowExecutor.test.ts
git commit -m "feat: execute loop nodes"
```

Expected: Commit succeeds.

### Task 5.2: Add API-Backed LLM Node with Image Input

**Files:**
- Modify: `src/routes/api.ts`
- Modify: `src/services/providers.ts`
- Modify: `web/src/canvas/nodeRenderers.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/pages/GptChatPage.tsx`
- Test: `tests/workflowExecutor.test.ts`

- [ ] **Step 1: Write LLM node planning test**

```ts
import { describe, expect, it } from 'vitest';
import { buildLlmNodeRequest } from '../src/services/workflowExecutor';

describe('LLM node requests', () => {
  it('includes image inputs when connected image nodes exist', () => {
    const request = buildLlmNodeRequest({
      prompt: '反推这张图的提示词',
      images: [{ dataUrl: 'data:image/png;base64,IMG', mimeType: 'image/png' }],
      providerId: 'openai-compatible',
      model: 'gpt-4.1-mini',
    });

    expect(request.messages[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'text' }),
      expect.objectContaining({ type: 'image_url' }),
    ]));
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/workflowExecutor.test.ts
```

Expected: FAIL until LLM request builder exists.

- [ ] **Step 3: Implement LLM node**

Required behavior:

```text
LLM node accepts prompt input and optional image input.
LLM node output can connect into prompt/API nodes.
GPT chat page uses the same provider request path.
Conversation history persists locally/server-side like other sessions.
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test -- tests/workflowExecutor.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/routes/api.ts src/services/providers.ts web/src/canvas/nodeRenderers.tsx web/src/canvas/ReferenceCanvas.tsx web/src/pages/GptChatPage.tsx tests/workflowExecutor.test.ts
git commit -m "feat: add api backed llm workflow node"
```

Expected: Commit succeeds.

---

## Milestone 6: Feature Page Completion

### Task 6.1: Complete Text2img, Enhance, Image Edit, Angle, Online, and GPT Pages

**Files:**
- Create/Modify: `web/src/pages/TextToImagePage.tsx`
- Create/Modify: `web/src/pages/EnhancePage.tsx`
- Create/Modify: `web/src/pages/ImageEditPage.tsx`
- Create/Modify: `web/src/pages/AngleControlPage.tsx`
- Create/Modify: `web/src/pages/OnlineImagePage.tsx`
- Create/Modify: `web/src/pages/GptChatPage.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/pages/__tests__/featurePages.test.tsx`

- [ ] **Step 1: Write feature page tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextToImagePage } from '../TextToImagePage';
import { EnhancePage } from '../EnhancePage';
import { ImageEditPage } from '../ImageEditPage';
import { AngleControlPage } from '../AngleControlPage';

describe('feature pages', () => {
  it('text-to-image page exposes size and batch controls', () => {
    render(<TextToImagePage />);
    expect(screen.getByText('尺寸')).toBeTruthy();
    expect(screen.getByText('批量')).toBeTruthy();
    expect(screen.getByText('版本管理')).toBeTruthy();
  });

  it('enhance page exposes strength and preview', () => {
    render(<EnhancePage />);
    expect(screen.getByText('增强程度')).toBeTruthy();
    expect(screen.getByText('预览')).toBeTruthy();
    expect(screen.getByText('管理')).toBeTruthy();
  });

  it('image edit page exposes input prompt reference preview and management', () => {
    render(<ImageEditPage />);
    expect(screen.getByText('输入提示词')).toBeTruthy();
    expect(screen.getByText('参考')).toBeTruthy();
    expect(screen.getByText('预览')).toBeTruthy();
    expect(screen.getByText('管理')).toBeTruthy();
  });

  it('angle page exposes camera controls and result panel', () => {
    render(<AngleControlPage />);
    expect(screen.getByText('输入图片')).toBeTruthy();
    expect(screen.getByText('相机控制')).toBeTruthy();
    expect(screen.getByText('参数')).toBeTruthy();
    expect(screen.getByText('结果')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
```

Expected: FAIL until pages expose required panels.

- [ ] **Step 3: Implement page panels**

Required page layout:

```text
Left parameter band.
Center preview/work area.
Right management/history band.
No oversized marketing hero.
No empty placeholder modules.
All visible labels are Chinese.
Every page can send a useful payload to either canvas or provider runner.
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add web/src/pages web/src/styles.css web/src/pages/__tests__/featurePages.test.tsx
git commit -m "feat: complete reference feature pages"
```

Expected: Commit succeeds.

---

## Milestone 7: API Settings and Provider Protocol

### Task 7.1: Add Protocol Probe and Capability Display

**Files:**
- Modify: `src/services/providers.ts`
- Modify: `src/routes/api.ts`
- Modify: `web/src/panels/ApiSettings.tsx`
- Modify: `web/src/styles.css`
- Test: `tests/providerProtocol.test.ts`

- [ ] **Step 1: Write provider protocol tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeProviderCapabilities } from '../src/services/providers';

describe('provider protocol capabilities', () => {
  it('normalizes provider capabilities for image workflows', () => {
    const capabilities = normalizeProviderCapabilities({
      supportsTextToImage: true,
      supportsImageToImage: true,
      supportsInpaint: false,
      supportsVideo: false,
      protocol: 'openai-compatible',
    });

    expect(capabilities.text2img).toBe(true);
    expect(capabilities.img2img).toBe(true);
    expect(capabilities.inpaint).toBe(false);
    expect(capabilities.protocol).toBe('openai-compatible');
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/providerProtocol.test.ts
```

Expected: FAIL until capability helper exists.

- [ ] **Step 3: Implement protocol probe**

Required behavior:

```text
API settings can test connection.
API settings can fetch models.
API settings can run protocol probe.
UI shows text2img/img2img/inpaint/video/LLM support.
Default provider can be selected.
No ModelScope-only fields are required.
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test -- tests/providerProtocol.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/services/providers.ts src/routes/api.ts web/src/panels/ApiSettings.tsx web/src/styles.css tests/providerProtocol.test.ts
git commit -m "feat: add provider protocol capabilities"
```

Expected: Commit succeeds.

---

## Milestone 8: History, Output, Logging, and Retry

### Task 8.1: Add Reference-Style Output and Run History

**Files:**
- Modify: `web/src/canvas/nodeRenderers.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `src/logger.ts`
- Modify: `src/routes/api.ts`
- Test: `tests/workflowExecutor.test.ts`

- [ ] **Step 1: Write output provenance test**

```ts
import { describe, expect, it } from 'vitest';
import { createNodeRunRecord } from '../src/logger';

describe('node run logging', () => {
  it('records node output provenance and latency', () => {
    const record = createNodeRunRecord({
      flowId: 'flow-1',
      nodeId: 'api-1',
      mode: 'img2img',
      providerId: 'provider-1',
      model: 'image-model',
      latencyMs: 1280,
      inputAssetIds: ['asset-input'],
      outputAssetIds: ['asset-output'],
      status: 'success',
    });

    expect(record.nodeId).toBe('api-1');
    expect(record.inputAssetIds).toEqual(['asset-input']);
    expect(record.outputAssetIds).toEqual(['asset-output']);
    expect(record.latencyMs).toBe(1280);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/workflowExecutor.test.ts
```

Expected: FAIL until logging helper exists.

- [ ] **Step 3: Implement output node behavior**

Required UI:

```text
Output node shows latest image grid.
Click image opens lightbox.
Lightbox supports previous/next.
Export selected image.
Drag output image back to canvas creates image node.
Output node records upstream generator provenance.
```

- [ ] **Step 4: Implement retry classification**

Required behavior:

```text
API network/5xx/rate-limit errors retry up to 3 times.
Validation errors do not retry.
Missing input errors do not retry.
Provider auth errors do not retry.
Failed node shows Chinese reason and retry button.
RAG log stores retry count and final status.
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm test -- tests/workflowExecutor.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

Run:

```powershell
git add web/src/canvas/nodeRenderers.tsx web/src/canvas/ReferenceCanvas.tsx src/logger.ts src/routes/api.ts tests/workflowExecutor.test.ts
git commit -m "feat: add output history and retry classification"
```

Expected: Commit succeeds.

---

## Milestone 9: Gene Library Productization

### Task 9.1: Finish Gene Library as MS Replacement

**Files:**
- Modify: `web/src/canvas/nodeRenderers.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx`

- [ ] **Step 1: Write gene library test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderCanvasNode } from '../nodeRenderers';

describe('gene library node', () => {
  it('renders three-column gene buttons and management actions', () => {
    render(renderCanvasNode({
      id: 'gene-1',
      type: 'gene',
      x: 0,
      y: 0,
      width: 420,
      height: 300,
      data: {
        genes: [
          { id: 'g1', name: '产品主图', prompt: '干净背景产品图' },
          { id: 'g2', name: '细节图', prompt: '微距质感' },
          { id: 'g3', name: '场景图', prompt: '真实使用场景' },
        ],
      },
    }));

    expect(screen.getByText('产品主图')).toBeTruthy();
    expect(screen.getByText('重命名')).toBeTruthy();
    expect(screen.getByText('删除')).toBeTruthy();
    expect(screen.getByText('添加基因')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
```

Expected: FAIL until gene UI is complete.

- [ ] **Step 3: Implement gene behavior**

Required behavior:

```text
Toolbar label is 基因库.
No MS生成 visible text remains.
Gene buttons render three per row.
Add gene can save selected prompt node.
Add gene can save selected subgraph workflow.
Click prompt gene creates prompt node.
Click workflow gene recreates saved nodes and edges.
Rename and delete are available per gene.
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test -- web/src/canvas/__tests__/ReferenceCanvas.interactions.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add web/src/canvas/nodeRenderers.tsx web/src/canvas/ReferenceCanvas.tsx web/src/styles.css
git commit -m "feat: finish gene library workflow templates"
```

Expected: Commit succeeds.

---

## Milestone 10: Visual Verification and Cleanup

### Task 10.1: Remove Mojibake, Dead UI, and Legacy Conflicts

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/canvas/ReferenceCanvas.tsx`
- Modify: `web/src/styles.css`
- Inspect and optionally remove unused legacy files only after import graph proves they are unused:
  - `web/src/shapeUtils.ts`
  - `web/src/TshuabuNodeShapeUtil.tsx`

- [ ] **Step 1: Search for forbidden or stale labels**

Run:

```powershell
rg "DX|MS生成|魔塔|ComfyUI 设置|鐢|鍙|杩|TODO|Lorem|placeholder" web src docs -n
```

Expected: Any hit is reviewed. Product decisions:

```text
DX must be Side.
MS生成 must be 基因库.
魔塔 must not appear in current UI.
ComfyUI 设置 may be removed or disabled because current product boundary excludes ComfyUI.
Mojibake must be replaced with Chinese.
```

- [ ] **Step 2: Remove visible stale UI**

Required behavior:

```text
No top-level local assets button if infinite canvas owns assets.
No duplicate API settings entry in the main nav and bottom settings.
No old run/read/save/export toolbar that conflicts with reference toolbar.
No bottom instruction panel unless it is a deliberate status/log panel.
```

- [ ] **Step 3: Build and run tests**

Run:

```powershell
npm test
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 4: Commit**

Run:

```powershell
git add web src docs
git commit -m "chore: clean stale labels and legacy ui conflicts"
```

Expected: Commit succeeds.

### Task 10.2: Browser Visual Acceptance

**Files:**
- Create: `docs/frontend-reports/2026-05-28-phase-one-parity-acceptance.md`
- Create: `tests/e2e/canvas-parity.spec.ts`

- [ ] **Step 1: Write Playwright smoke**

Test expectations:

```ts
import { expect, test } from '@playwright/test';

test('reference shell and canvas are usable', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/');
  await expect(page.getByText('Side')).toBeVisible();
  await expect(page.getByText('无限画布')).toBeVisible();
  await page.getByText('无限画布').click();
  await expect(page.getByText('选择画布')).toBeVisible();
});
```

- [ ] **Step 2: Run e2e smoke**

Run:

```powershell
npm run dev
npx playwright test tests/e2e/canvas-parity.spec.ts --headed
```

Expected: Test passes and browser shows reference-style shell.

- [ ] **Step 3: Manual acceptance checklist**

Checklist:

```text
Sidebar collapsed icons are centered.
Sidebar expanded labels have reference-sized typography.
Bottom controls keep correct scale in both collapsed and expanded states.
Theme toggle changes visible theme state.
Chinese toggle changes or confirms Chinese state.
API settings modal has no garbled tooltip.
Canvas picker refresh/delete tooltips are Chinese.
Opened canvas can pan by dragging empty area.
Ctrl box-select works.
Delete key removes selected nodes.
Image node accepts click upload.
Image node accepts drag upload.
Prompt node shows character count.
Dragging a port shows preview line.
Releasing a line opens command menu.
Existing edge can be disconnected.
Shift-drag cut removes crossed edge.
API node can use prompt input.
API node can use image input for img2img.
Inpaint node can use brush mask.
Output node receives result.
Autosave status is visible.
Reload restores canvas content.
```

- [ ] **Step 4: Write acceptance report**

Report format:

```markdown
# Phase One Parity Acceptance

## Passed

## Failed

## Deferred By Product Decision
- ComfyUI workflow execution.
- ModelScope/MS generation.

## Screenshots

## Remaining Risk
```

- [ ] **Step 5: Final commit**

Run:

```powershell
git add docs/frontend-reports/2026-05-28-phase-one-parity-acceptance.md tests/e2e/canvas-parity.spec.ts
git commit -m "test: add phase one visual parity acceptance"
```

Expected: Commit succeeds.

---

## Execution Order

1. Milestone 0: baseline audit.
2. Milestone 1: unified shell and UI primitives.
3. Milestone 2: persistence/recovery.
4. Milestone 3: canvas nodes and edge interactions.
5. Milestone 4: img2img/inpaint truth and image edit.
6. Milestone 5: loop and LLM execution.
7. Milestone 6: feature page completion.
8. Milestone 7: API settings/protocol.
9. Milestone 8: output/history/logging/retry.
10. Milestone 9: gene library.
11. Milestone 10: cleanup and visual acceptance.

---

## Progress Tracking

| Milestone | Status | Exit Criteria |
|---|---|---|
| 0 Baseline audit | Not started | Screenshots and audit report committed |
| 1 UI system | Not started | Shell tests pass and no visible DX/garbled nav text |
| 2 Persistence | Not started | Canvas reload/recovery/trash restore work |
| 3 Canvas UI | Not started | Reference-style nodes, links, menus, disconnect work |
| 4 Image truth | Not started | Img2img and inpaint payload tests pass |
| 5 Workflow nodes | Not started | Loop and LLM nodes execute |
| 6 Feature pages | Not started | Each sidebar page has real panels and tests |
| 7 API settings | Not started | Protocol/capability probe visible |
| 8 History/logging | Not started | Output/history/retry records are testable |
| 9 Gene library | Not started | No MS label remains; workflow genes restore subgraphs |
| 10 Acceptance | Not started | Playwright/manual checklist report committed |

---

## Self-Review

### Spec Coverage

- Import jpg/png by file/drag/paste: covered in Milestone 3 and 10.
- Canvas nodes and executable connections: covered in Milestone 3 and 5.
- Text2img + inpaint returning results to canvas: covered in Milestone 4 and 8.
- Failed node highlight and retry max 3 API errors: covered in Milestone 8.
- Session version chain/history: covered in Milestone 2 and 8.
- Export selected result image: covered in Milestone 8 and 10.
- RAG events with workflow/input/output/latency/selection metadata: covered in Milestone 4 and 8.
- Reference UI parity: covered in Milestone 0, 1, 3, 6, and 10.
- Gene library replacing MS: covered in Milestone 9.

### Deferred Items

- ComfyUI custom workflows are intentionally deferred.
- ModelScope, MS generation, and LoRA are intentionally deferred.
- Packaged Python/Mac-specific packaging is intentionally deferred.

### Verification Policy

No milestone can be considered complete unless:

```powershell
npm test
npm run build
```

both pass, and any milestone touching UI also has a browser screenshot or Playwright acceptance note.

