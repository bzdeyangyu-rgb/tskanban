# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

- 安装依赖：`npm install`
- TypeScript 构建：`npm run build`
- 本地开发入口（CLI + Web 命令分发）：`npm run dev -- <command>`
- 启动 Web 服务：`npm run dev -- serve:web`
- 生产方式启动（先构建）：`npm run build && npm run start`
- 查看最近日志：`npm run dev -- show:latest-logs --limit 20`

### 主要 CLI 子命令

- 文生图：
  `npm run dev -- run:text2img --model <model> --prompt "..." [--negativePrompt "..."] [--size 1024x1024] [--steps 30] [--strength 0.5] [--seed 123]`
- 局部重绘：
  `npm run dev -- run:inpaint --model <model> --prompt "..." --inputImage <path-or-url> --maskImage <path-or-url>`
- 模板：
  - `npm run dev -- template:save --name <name> --prompt "..." [--negativePrompt "..."]`
  - `npm run dev -- template:list`
  - `npm run dev -- template:use --name <name>`

### 测试说明

- 当前仓库未配置真实测试框架；`npm test` 仅输出占位信息（`No tests yet`）。
- 因此目前不存在“单测单文件/单用例运行命令”。

## 运行时与环境变量

图像 API 由 `src/imageApi.ts` 读取并校验环境变量（Zod）：

- `IMAGE_API_BASE_URL`（必需）
- `IMAGE_API_KEY`（可选）
- `IMAGE_API_TEXT2IMG_PATH`（默认 `/text2img`）
- `IMAGE_API_INPAINT_PATH`（默认 `/inpaint`）
- `IMAGE_API_TIMEOUT_MS`（默认 `120000`）
- `PORT`（Web 服务端口，默认 `8787`）

## 高层架构

这是一个 Node.js + TypeScript 的单体应用，包含：

1. **命令分发层（`src/index.ts`）**
   - 负责 CLI 命令解析与分发。
   - `serve:web` 启动 HTTP 服务；`run:text2img` / `run:inpaint` 走直接 API 调用链路。

2. **HTTP 服务层（`src/server.ts` + `src/routes/api.ts`）**
   - `server.ts` 负责 Express 初始化、静态资源挂载（`/web`、`/outputs`）、JSON body 限制。
   - `api.ts` 负责会话、上传、生成、流程执行、日志查询、模板接口。

3. **领域服务层**
   - `src/services/assets.ts`：资产落盘与资产元数据生成（`outputs/YYYYMMDD/...`）。
   - `src/services/sessions.ts`：会话与版本链读写（`logs/sessions/<sessionId>.json`）。
   - `src/templates.ts`：提示词模板持久化（`prompts/templates.json`）。

4. **外部图像 API 适配层（`src/imageApi.ts`）**
   - 统一 text2img / inpaint 请求格式。
   - 兼容多种返回字段，提取输出资产 URL（`output/images/url/result/...`）。

5. **日志与RAG沉淀层（`src/logger.ts`）**
   - 双写日志：
     - 结构化事件：`logs/rag_events.jsonl`
     - 人类可读复盘：`logs/RAG_LOG.md`
   - 记录 flow/node/retry/selection/local_prompt 等字段，用于后续 RAG 材料。

6. **前端（`web/`）**
   - 原生 HTML/CSS/JS（非框架）。
   - 调用 `/api/*` 接口进行素材上传、生成、流程执行、历史查看与日志查看。

## 关键执行链路

### 图像生成链路

`/api/text2img` 或 `/api/inpaint`：
1. Zod 校验请求（`src/types/contracts.ts`）
2. 读取/创建 session
3. 调 `generateImage`
4. 输出资产标准化并写入 session
5. 追加版本（version chain）
6. 记录 RAG 事件

### 节点流程链路

`/api/flows/validate` + `/api/flows/execute`：
1. 校验 flow 图结构（节点/边、拓扑顺序、环检测）
2. 按顺序执行节点
3. 失败节点按 API 错误最多重试 3 次
4. 失败即停并返回节点状态数组
5. 记录 flow 结构、节点状态、重试次数、耗时

## 持久化约定

- 会话与版本：`logs/sessions/<sessionId>.json`
- 结构化事件：`logs/rag_events.jsonl`
- Markdown 复盘：`logs/RAG_LOG.md`
- 输出素材：`outputs/<YYYYMMDD>/...`
- 提示词模板：`prompts/templates.json`

这些目录是运行时核心状态，修改相关代码时要保持字段兼容性，尤其是日志字段命名与版本链结构。

## 当前开发状态（相对 SPEC）

- 已有后端能力：`/api/sessions`、`/api/upload`、`/api/text2img`、`/api/inpaint`、`/api/logs`、`/api/templates`，以及流程接口 `/api/flows/validate`、`/api/flows/execute`。
- 已有流程执行语义：基础 flow 校验（含环检测）、按顺序执行、失败即停、失败节点重试（最多 3 次）。
- 已有日志沉淀：JSONL + Markdown 双写，并包含 flow/node/retry/selection/local_prompt 等字段。
- 前端当前是原生 `web/index.html + web/app.js + web/styles.css`，无前端框架。
- 前端已有基础节点化交互与缩放能力，但与 PureRef 风格“无限素材画布”仍有差距（素材板能力仍在演进中）。
- 当前无正式测试框架；变更主要依赖 `npm run build` 与手工联调验证。

