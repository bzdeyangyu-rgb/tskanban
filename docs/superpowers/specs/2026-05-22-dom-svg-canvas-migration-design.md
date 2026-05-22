# DOM/SVG 无限画布迁移规格

## 目标

把当前无限画布从 tldraw 外壳迁移到参考项目同款的 DOM 节点 + SVG 连线内核。视觉和交互优先贴近 `references/Infinite-Canvas/static/canvas.html`，业务层继续使用现有的 `CanvasSnapshot`、运行、保存、读取、上传图片和 API Provider。

## 保留

- 现有 API：`executeCanvasFlow`、`saveCanvasSnapshot`、`loadCanvasSnapshot`、`uploadImage`。
- 现有快任务页和侧栏入口。
- 现有 `CanvasSnapshot` 数据结构：nodes、edges、viewport、selectedNodeId。
- 输出节点承接运行结果并支持导出。

## 替换

- 不再把节点渲染、连线、选择、拖拽、删除、缩放寄托在 tldraw 上。
- 画布内核改为 React state 管理：
  - 节点：绝对定位 DOM 卡片。
  - 连线：底层 SVG path。
  - 端口：节点右侧输出端口、左侧输入命中区。
  - 菜单：从端口拖出后出现参考项目风格的节点创建菜单。
  - 分组：对选中节点生成视觉分组框，后续可扩展成组内联动。

## 第一迁移切片

- 新增 `ReferenceCanvas` 组件和命令句柄，承接 App 的添加节点、导入图片、运行编译、读取恢复、状态更新、输出写入、删除、分组。
- 无限画布页面先接入新组件，旧 tldraw 文件暂时保留为回退参考，不在主入口使用。
- 节点类型先覆盖当前工具栏：图片、提示词、循环、API生成、MS生成、视频生成、ComfyUI、Output、分组。
- 删除 `LLM` 节点入口，保留 GPT 对话作为侧栏 API 页面。

## 验收点

- 黑夜模式进入画布不再跳白底。
- 端口拖线有可见曲线，松开后可创建下游节点并自动连线。
- 点击图片节点可导入图片，拖图到节点可导入到该节点。
- Delete / Backspace 能删除选中节点和相关连线。
- 运行、保存、读取继续使用同一份 `CanvasSnapshot`。
- 右上工具栏回到参考项目布局和视觉，不混入其他开源工具栏。
