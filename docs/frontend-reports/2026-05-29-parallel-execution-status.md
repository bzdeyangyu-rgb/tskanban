# 第一阶段并行开发主控记录

更新时间：2026-05-29

## 当前主分支

- 主 worktree：`D:/Tskanban/.worktrees/phase-one-visual-closure`
- 主分支：`codex/gene-library`
- 并行计划提交：`80902ad docs: add parallel execution guardrails`

## 第一轮并行轨道

| 轨道 | Worktree | 分支 | 状态 | 文件边界 |
|---|---|---|---|---|
| A 样例级 UI 系统 | `D:/Tskanban/.worktrees/phase-one-ui-system` | `codex/phase-one-ui-system` | 进行中 | 产品壳、公共 UI、样式 token |
| C 图像 API 真实性 | `D:/Tskanban/.worktrees/phase-one-image-api` | `codex/phase-one-image-api` | 进行中 | `imageApi`、API runner、图像 API 测试 |
| E 历史日志保存 | `D:/Tskanban/.worktrees/phase-one-history-logs` | `codex/phase-one-history-logs` | 进行中 | 画布保存、session、logger、route、保存/日志测试 |

## 主进程职责

主进程暂不改业务代码，只做：

1. 审查 subagent 是否越界。
2. 审查测试和构建结果。
3. 处理合并顺序和冲突。
4. 向用户汇报完成情况、成果和下一步计划。

## 本轮禁止事项

- 不允许多个任务同时改 `web/src/canvas/ReferenceCanvas.tsx`。
- 不允许多个任务同时大改 `web/src/styles.css`。
- 不允许重新引入 `DX`、`MS生成`、`魔塔`、乱码中文。
- 不允许把 ComfyUI 或 ModelScope 重新变成当前主流程依赖。

## 首轮完成标准

### A UI 系统

```powershell
npm test -- web/src/pages/__tests__/featurePages.test.tsx
npm run build
rg "DX|MS生成|魔塔|鐢|鍙|杩" web/src -n
```

### C 图像 API

```powershell
npm test -- tests/imageApi.test.ts
npm run build
```

### E 历史日志

```powershell
npm test -- tests/workflowExecutor.test.ts tests/canvasPersistence.test.ts
npm run build
```

## 待主进程审查

- [ ] A 是否只修改允许文件。
- [ ] C 是否证明 img2img 和 inpaint payload 真实带图。
- [ ] E 是否实现 deletedAt/restore 和重试分类。
- [ ] 三条轨道是否都能独立 build。
- [ ] 合并前是否有可见 UI 残留文案。

