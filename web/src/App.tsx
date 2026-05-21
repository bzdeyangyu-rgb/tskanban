import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Editor } from "tldraw";
import {
  Box,
  Braces,
  CircleDot,
  Clapperboard,
  CloudLightning,
  Download,
  Edit3,
  FolderOpen,
  Globe2,
  Grid3X3,
  Group,
  Image,
  ImagePlus,
  Languages,
  Layers,
  Link,
  ListTodo,
  MessageSquare,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Save,
  SlidersHorizontal,
  Settings,
  Sun,
  TextCursorInput,
  Trash2,
  WandSparkles,
  Workflow,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";
import {
  executeCanvasFlow,
  fetchProviders,
  fetchSession,
  loadCanvasSnapshot,
  saveCanvasSnapshot,
  uploadImage,
  type ApiProvider,
  type CanvasSession,
  type FlowExecutionNode
} from "./api/client";
import { CanvasApp } from "./canvas/CanvasApp";
import { compileCanvasSnapshot } from "./canvas/flowCompiler";
import { imageFilesFromList } from "./canvas/importImages";
import type { CanvasNodeKind, CanvasNodeStatus } from "./canvas/flowTypes";
import {
  addNodeToEditor,
  addNodeToEditorAt,
  addOutputsToOutputNode,
  connectNodes,
  isTshuabuNodeMeta,
  mergeNodeData,
  restoreCanvasSnapshot,
  selectedOutputAsset,
  updateNodeStatuses,
  type TshuabuNodeMeta
} from "./canvas/shapeUtils";
import { ApiSettings } from "./panels/ApiSettings";
import { AssetImportPanel } from "./panels/AssetImportPanel";
import { CanvasPersistenceBar } from "./panels/CanvasPersistenceBar";
import { Inspector } from "./panels/Inspector";
import { NodePalette } from "./panels/NodePalette";
import { RunHistory } from "./panels/RunHistory";

type SelectedNode = {
  id: string;
  meta: TshuabuNodeMeta;
};

type CanvasGateItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type DrawerMode = "assets" | "nodes" | "settings" | "history" | null;

type StudioPageId = "zimage" | "enhance" | "klein" | "angle" | "online" | "gpt-chat" | "canvas" | "api-settings";

type DragLink = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type LinkCommandMenu = {
  originId: string;
  nodeType: CanvasNodeKind;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
};

const CANVAS_LIST_KEY = "tshuabu:canvasGateItems";

const studioNavItems: Array<{ id: Exclude<StudioPageId, "api-settings">; label: string; icon: LucideIcon }> = [
  { id: "zimage", label: "\u6587\u751f\u56fe", icon: Image },
  { id: "enhance", label: "\u7ec6\u8282\u589e\u5f3a", icon: Zap },
  { id: "klein", label: "\u56fe\u7247\u7f16\u8f91", icon: Edit3 },
  { id: "angle", label: "\u89d2\u5ea6\u63a7\u5236", icon: Box },
  { id: "online", label: "\u5728\u7ebf\u751f\u56fe", icon: Globe2 },
  { id: "gpt-chat", label: "GPT \u5bf9\u8bdd", icon: MessageSquare },
  { id: "canvas", label: "\u65e0\u9650\u753b\u5e03", icon: Grid3X3 }
];

const apiPageCopy: Record<
  Exclude<StudioPageId, "canvas" | "api-settings">,
  { kicker: string; title: string; description: string; actions: string[] }
> = {
  zimage: {
    kicker: "Text to Image",
    title: "\u6587\u751f\u56fe",
    description: "\u4fdd\u7559\u53c2\u8003\u9879\u76ee\u7684\u72ec\u7acb\u5165\u53e3\uff0c\u540e\u7eed\u76f4\u63a5\u8c03\u7528\u6211\u4eec\u7684\u56fe\u50cf\u751f\u6210 API\uff0c\u4e0d\u63a5 ComfyUI\u3002",
    actions: ["\u63d0\u793a\u8bcd", "\u5c3a\u5bf8", "\u98ce\u683c", "\u751f\u6210"]
  },
  enhance: {
    kicker: "Detail Enhance",
    title: "\u7ec6\u8282\u589e\u5f3a",
    description: "\u7528\u4e8e\u653e\u5927\u3001\u9510\u5316\u3001\u8d28\u611f\u8865\u5f3a\u548c\u7ec6\u8282\u91cd\u7ed8\uff0c\u80fd\u529b\u5c42\u8d70\u7edf\u4e00 API Provider\u3002",
    actions: ["\u4e0a\u4f20\u56fe\u7247", "\u589e\u5f3a\u5f3a\u5ea6", "\u4fdd\u771f\u5ea6", "\u5f00\u59cb\u589e\u5f3a"]
  },
  klein: {
    kicker: "Image Edit",
    title: "\u56fe\u7247\u7f16\u8f91",
    description: "\u627f\u63a5\u5c40\u90e8\u91cd\u7ed8\u3001\u64e6\u9664\u3001\u66ff\u6362\u548c\u7f16\u8f91\u6307\u4ee4\uff0c\u4ea4\u4e92\u4fdd\u6301\u53c2\u8003\u9879\u76ee\u7684\u529f\u80fd\u5206\u533a\u3002",
    actions: ["\u9009\u62e9\u56fe\u7247", "\u7f16\u8f91\u6307\u4ee4", "\u8499\u7248", "\u63d0\u4ea4\u7f16\u8f91"]
  },
  angle: {
    kicker: "Angle Control",
    title: "\u89d2\u5ea6\u63a7\u5236",
    description: "\u7528\u4e8e\u89c6\u89d2\u53d8\u5316\u3001\u6784\u56fe\u63a7\u5236\u548c\u53c2\u8003\u56fe\u7ea6\u675f\uff0c\u540e\u7aef\u7edf\u4e00\u6620\u5c04\u5230\u53ef\u7528\u6a21\u578b\u53c2\u6570\u3002",
    actions: ["\u53c2\u8003\u56fe", "\u89d2\u5ea6", "\u6784\u56fe", "\u751f\u6210\u53d8\u4f53"]
  },
  online: {
    kicker: "Online Render",
    title: "\u5728\u7ebf\u751f\u56fe",
    description: "\u4f5c\u4e3a\u8f7b\u91cf\u751f\u6210\u5165\u53e3\uff0c\u9002\u5408\u5feb\u901f\u6d4b\u8bd5\u6a21\u578b\u3001\u63d0\u793a\u8bcd\u548c\u53c2\u6570\u9884\u8bbe\u3002",
    actions: ["\u6a21\u578b", "\u63d0\u793a\u8bcd", "\u6279\u91cf\u6570", "\u5728\u7ebf\u751f\u6210"]
  },
  "gpt-chat": {
    kicker: "GPT Chat",
    title: "GPT \u5bf9\u8bdd",
    description: "\u4fdd\u7559\u53c2\u8003\u9879\u76ee\u7684\u5bf9\u8bdd\u5165\u53e3\uff0c\u7528\u6211\u4eec\u7684 API \u505a\u521b\u610f\u6c9f\u901a\u3001\u63d0\u793a\u8bcd\u6574\u7406\u548c\u6d41\u7a0b\u5efa\u8bae\u3002",
    actions: ["\u4f1a\u8bdd", "\u4e0a\u4e0b\u6587", "\u63d0\u793a\u8bcd\u4f18\u5316", "\u53d1\u9001"]
  }
};

type ApiPageKind = Exclude<StudioPageId, "canvas" | "api-settings">;

const quickApiNodeType: Record<ApiPageKind, CanvasNodeKind> = {
  zimage: "api_text2img",
  enhance: "api_img2img",
  klein: "api_inpaint",
  angle: "api_img2img",
  online: "api_text2img",
  "gpt-chat": "prompt"
};

const apiPageControls: Record<
  ApiPageKind,
  {
    uploadLabel?: string;
    promptLabel: string;
    previewTitle: string;
    managementTitle: string;
    fields: Array<{ key: string; label: string; type: "text" | "select" | "range" | "number"; options?: string[]; defaultValue: string }>;
  }
> = {
  zimage: {
    promptLabel: "输入提示词",
    previewTitle: "生成预览",
    managementTitle: "批量管理 / 版本管理",
    fields: [
      { key: "size", label: "尺寸", type: "select", options: ["1024x1024", "1024x1536", "1536x1024", "768x1344"], defaultValue: "1024x1024" },
      { key: "batch", label: "批量", type: "number", defaultValue: "1" },
      { key: "style", label: "风格", type: "text", defaultValue: "" }
    ]
  },
  enhance: {
    uploadLabel: "输入图片",
    promptLabel: "增强说明",
    previewTitle: "画布预览",
    managementTitle: "增强记录管理",
    fields: [
      { key: "strength", label: "增强程度", type: "range", defaultValue: "60" },
      { key: "scale", label: "放大倍率", type: "select", options: ["1x", "2x", "4x"], defaultValue: "2x" },
      { key: "detail", label: "细节保真", type: "range", defaultValue: "70" }
    ]
  },
  klein: {
    uploadLabel: "参考图片",
    promptLabel: "输入提示词",
    previewTitle: "编辑预览",
    managementTitle: "图片编辑管理",
    fields: [
      { key: "mask", label: "蒙版模式", type: "select", options: ["自动识别", "手动蒙版", "全图编辑"], defaultValue: "自动识别" },
      { key: "strength", label: "编辑强度", type: "range", defaultValue: "55" },
      { key: "reference", label: "参考权重", type: "range", defaultValue: "65" }
    ]
  },
  angle: {
    uploadLabel: "输入图片",
    promptLabel: "角度说明",
    previewTitle: "结果预览",
    managementTitle: "角度版本管理",
    fields: [
      { key: "camera", label: "相机控制", type: "select", options: ["正面", "左 45°", "右 45°", "俯视", "低角度"], defaultValue: "左 45°" },
      { key: "focal", label: "焦距", type: "select", options: ["24mm", "35mm", "50mm", "85mm"], defaultValue: "35mm" },
      { key: "strength", label: "参数强度", type: "range", defaultValue: "50" }
    ]
  },
  online: {
    promptLabel: "在线提示词",
    previewTitle: "在线结果",
    managementTitle: "在线任务管理",
    fields: [
      { key: "source", label: "平台", type: "select", options: ["API Provider", "ModelScope", "远程队列"], defaultValue: "API Provider" },
      { key: "size", label: "尺寸", type: "select", options: ["1024x1024", "1024x1536", "1536x1024"], defaultValue: "1024x1024" },
      { key: "batch", label: "批量", type: "number", defaultValue: "1" }
    ]
  },
  "gpt-chat": {
    promptLabel: "对话输入",
    previewTitle: "回复预览",
    managementTitle: "会话管理",
    fields: [
      { key: "mode", label: "模式", type: "select", options: ["提示词优化", "创意讨论", "流程建议"], defaultValue: "提示词优化" },
      { key: "context", label: "上下文", type: "text", defaultValue: "" },
      { key: "temperature", label: "发散程度", type: "range", defaultValue: "50" }
    ]
  }
};

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState("等待画布输入");
  const [lastRunNodes, setLastRunNodes] = useState<FlowExecutionNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [session, setSession] = useState<CanvasSession | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [activePage, setActivePage] = useState<StudioPageId>("canvas");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [dragLink, setDragLink] = useState<DragLink | null>(null);
  const [linkCommandMenu, setLinkCommandMenu] = useState<LinkCommandMenu | null>(null);
  const placementIndexRef = useRef(0);
  const canvasId = useMemo(() => {
    const existing = window.localStorage.getItem("tshuabu:lastCanvasId");
    if (existing) {
      return existing;
    }
    const next = `c_web_${Date.now().toString(36)}`;
    window.localStorage.setItem("tshuabu:lastCanvasId", next);
    return next;
  }, []);
  const [canvasItems, setCanvasItems] = useState<CanvasGateItem[]>(() => readCanvasGateItems(canvasId));

  useEffect(() => {
    document.documentElement.dataset.studioTheme = theme;
  }, [theme]);

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    const handleLinkDragStart = (event: Event) => {
      if (!editor) {
        setStatus("画布还在加载");
        return;
      }

      const detail = (event as CustomEvent).detail as Partial<LinkCommandMenu> & {
        shapeId?: string;
        clientX?: number;
        clientY?: number;
      };
      if (!detail.shapeId || typeof detail.clientX !== "number" || typeof detail.clientY !== "number") {
        return;
      }

      setLinkCommandMenu(null);
      setDragLink({ x1: detail.clientX, y1: detail.clientY, x2: detail.clientX, y2: detail.clientY });

      const handleMove = (moveEvent: PointerEvent) => {
        setDragLink((current) =>
          current ? { ...current, x2: moveEvent.clientX, y2: moveEvent.clientY } : current
        );
      };

      const handleUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        setDragLink(null);
        const pagePoint = editor.screenToPage({ x: upEvent.clientX, y: upEvent.clientY });
        setLinkCommandMenu({
          originId: detail.shapeId!,
          nodeType: (detail.nodeType as CanvasNodeKind) ?? "prompt",
          clientX: upEvent.clientX,
          clientY: upEvent.clientY,
          pageX: pagePoint.x,
          pageY: pagePoint.y
        });
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp, { once: true });
    };

    window.addEventListener("tshuabu:link-drag-start", handleLinkDragStart);
    return () => window.removeEventListener("tshuabu:link-drag-start", handleLinkDragStart);
  }, [editor]);

  useEffect(() => {
    const handleNodeDataChange = (event: Event) => {
      if (!editor) {
        return;
      }
      const detail = (event as CustomEvent).detail as { nodeId?: string; patch?: Record<string, unknown> };
      if (!detail.nodeId || !detail.patch) {
        return;
      }
      const shape = editor.getShape(detail.nodeId as never);
      if (!shape || !isTshuabuNodeMeta(shape.meta)) {
        return;
      }
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        meta: mergeNodeData(shape.meta, detail.patch)
      });
    };

    const handleImageNodeFiles = async (event: Event) => {
      if (!editor) {
        return;
      }
      const detail = (event as CustomEvent).detail as { nodeId?: string; files?: File[] };
      const file = detail.files?.[0];
      if (!detail.nodeId || !file) {
        return;
      }
      const shape = editor.getShape(detail.nodeId as never);
      if (!shape || !isTshuabuNodeMeta(shape.meta)) {
        return;
      }
      try {
        setStatus(`正在导入 ${file.name}`);
        const uploaded = await uploadImage(file, session?.sessionId);
        setSession(await fetchSession(uploaded.sessionId));
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          meta: mergeNodeData(shape.meta, {
            assetId: uploaded.asset.assetId,
            url: uploaded.asset.publicUrl,
            name: file.name,
            mime: uploaded.asset.mime,
            roleTag: "素材"
          })
        });
        setStatus(`已导入到图片节点：${file.name}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    };

    window.addEventListener("tshuabu:node-data-change", handleNodeDataChange);
    window.addEventListener("tshuabu:image-node-files", handleImageNodeFiles);
    return () => {
      window.removeEventListener("tshuabu:node-data-change", handleNodeDataChange);
      window.removeEventListener("tshuabu:image-node-files", handleImageNodeFiles);
    };
  }, [editor, session?.sessionId]);

  useEffect(() => {
    if (!editor) {
      setSelectedNode(null);
      return undefined;
    }

    const readSelection = () => {
      const selectedId = editor.getSelectedShapeIds().find((id) => isTshuabuNodeMeta(editor.getShape(id)?.meta));
      if (!selectedId) {
        setSelectedNode(null);
        return;
      }

      const shape = editor.getShape(selectedId);
      if (!isTshuabuNodeMeta(shape?.meta)) {
        setSelectedNode(null);
        return;
      }

      setSelectedNode({
        id: String(selectedId),
        meta: shape.meta
      });
    };

    readSelection();
    const interval = window.setInterval(readSelection, 250);
    return () => window.clearInterval(interval);
  }, [editor]);

  useEffect(() => {
    if (!editor || !isCanvasOpen || activePage !== "canvas") {
      return undefined;
    }

    const handleDeleteKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const selectedIds = editor.getSelectedShapeIds();
      if (selectedIds.length === 0) {
        return;
      }

      event.preventDefault();
      const deleteShapes = (editor as unknown as { deleteShapes?: (ids: unknown[]) => void }).deleteShapes;
      if (typeof deleteShapes === "function") {
        deleteShapes.call(editor, selectedIds);
        setStatus(`已删除 ${selectedIds.length} 个对象`);
      }
    };

    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [activePage, editor, isCanvasOpen]);

  const persistCanvasItems = useCallback((items: CanvasGateItem[]) => {
    setCanvasItems(items);
    window.localStorage.setItem(CANVAS_LIST_KEY, JSON.stringify(items));
  }, []);

  const handleOpenCanvas = useCallback((itemId: string) => {
    window.localStorage.setItem("tshuabu:lastCanvasId", itemId);
    setIsCanvasOpen(true);
    setStatus("画布已打开，可以开始创作");
  }, []);

  const handleNewCanvas = useCallback(() => {
    const nextId = `c_web_${Date.now().toString(36)}`;
    const nextItem = {
      id: nextId,
      title: `新建画布 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem("tshuabu:lastCanvasId", nextId);
    persistCanvasItems([nextItem, ...canvasItems].slice(0, 8));
    setIsCanvasOpen(true);
    setStatus("已创建新画布");
  }, [canvasItems, persistCanvasItems]);

  const handleRefreshCanvases = useCallback(() => {
    setCanvasItems(readCanvasGateItems(canvasId));
    setStatus("画布列表已刷新");
  }, [canvasId]);

  const handleClearCanvases = useCallback(() => {
    const resetItems = readCanvasGateItems(canvasId, true);
    persistCanvasItems(resetItems);
    setStatus("已保留当前画布，清理旧入口");
  }, [canvasId, persistCanvasItems]);

  const handleAddNode = useCallback(
    (type: CanvasNodeKind) => {
      if (!editor) {
        setStatus("画布还在加载");
        return;
      }

      const definition = nodeDefinition(type, providers[0]?.id);
      addNodeToEditor(editor, definition, placementIndexRef.current);
      placementIndexRef.current += 1;
      setStatus(`已添加 ${definition.title}`);
    },
    [editor, providers]
  );

  const handleCreateLinkedNode = useCallback(
    (type: CanvasNodeKind) => {
      if (!editor || !linkCommandMenu) {
        return;
      }

      const definition = nodeDefinition(type, providers[0]?.id);
      const nextId = addNodeToEditorAt(editor, definition, linkCommandMenu.pageX + 24, linkCommandMenu.pageY - 70);
      connectNodes(editor, linkCommandMenu.originId, nextId);
      placementIndexRef.current += 1;
      setLinkCommandMenu(null);
      setStatus(`已创建并连接 ${definition.title}`);
    },
    [editor, linkCommandMenu, providers]
  );

  const handleConnectMode = useCallback(() => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    editor.setCurrentTool("arrow");
    setStatus("连接模式：从一个节点拖出连线到另一个节点");
  }, [editor]);

  const handleGroupSelected = useCallback(() => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    const selectedIds = editor.getSelectedShapeIds();
    if (selectedIds.length < 2) {
      setStatus("请先选择至少两个图片或提示词节点再分组");
      return;
    }

    const groupShapes = (editor as unknown as { groupShapes?: (ids: unknown[]) => void }).groupShapes;
    if (typeof groupShapes === "function") {
      groupShapes.call(editor, selectedIds);
      setStatus(`已分组 ${selectedIds.length} 个节点`);
      return;
    }

    setStatus("当前画布内核暂不支持真实分组，后续会换成参考项目的分组模型");
  }, [editor]);

  const handleUpdateSelectedNode = useCallback(
    (patch: Record<string, unknown>) => {
      if (!editor || !selectedNode) {
        return;
      }

      const shape = editor.getShape(selectedNode.id);
      if (!shape || !isTshuabuNodeMeta(shape.meta)) {
        return;
      }

      const nextMeta = mergeNodeData(shape.meta, patch);
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        meta: nextMeta
      });
      setSelectedNode({ id: String(shape.id), meta: nextMeta });
    },
    [editor, selectedNode]
  );

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

      try {
        setStatus(`正在导入 ${imageFiles.length} 张图片`);
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

        if (currentSessionId) {
          setSession(await fetchSession(currentSessionId));
        }
        setStatus(`已导入 ${imageFiles.length} 张图片`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    },
    [editor, session?.sessionId]
  );

  const handleRun = useCallback(async () => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    try {
      ensureOutputNode(editor, placementIndexRef);
      const snapshot = compileCanvasSnapshot(editor, canvasId, session?.sessionId);
      if (snapshot.nodes.length === 0) {
        setStatus("请先添加节点");
        return;
      }

      updateNodeStatuses(
        editor,
        snapshot.nodes.map((node) => ({ nodeId: node.id, status: "running" as CanvasNodeStatus }))
      );
      setStatus(`提交流程：${snapshot.nodes.length} 个节点，${snapshot.edges.length} 条连线`);
      const result = await executeCanvasFlow(snapshot);
      setLastRunNodes(result.nodes);
      const nextSession = await fetchSession(result.sessionId);
      setSession(nextSession);
      updateNodeStatuses(
        editor,
        result.nodes.map((node) => ({
          nodeId: node.nodeId,
          status: node.status as CanvasNodeStatus,
          errorMessage: node.errorMessage
        }))
      );
      addOutputsToOutputNode(editor, result.outputAssets);
      setStatus(
        result.run.status === "failed"
          ? `执行失败：${result.run.errorMessage ?? "请检查失败节点"}`
          : `执行完成：${result.nodes.length} 个节点有状态`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [canvasId, editor, session?.sessionId]);

  const handleSaveCanvas = useCallback(async () => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    try {
      const snapshot = compileCanvasSnapshot(editor, canvasId, session?.sessionId);
      const saved = await saveCanvasSnapshot(snapshot, "当前画布");
      const nextSavedAt = new Date(saved.updatedAt).toLocaleString("zh-CN");
      setSavedAt(nextSavedAt);
      persistCanvasItems(upsertCanvasItem(canvasItems, canvasId, "当前画布", saved.updatedAt));
      setStatus(`画布已保存：${saved.canvasId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [canvasId, canvasItems, editor, persistCanvasItems, session?.sessionId]);

  const handleLoadCanvas = useCallback(async () => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    try {
      const saved = await loadCanvasSnapshot(canvasId);
      restoreCanvasSnapshot(editor, saved);
      setSavedAt(new Date(saved.updatedAt).toLocaleString("zh-CN"));
      if (saved.sessionId) {
        setSession(await fetchSession(saved.sessionId));
      }
      setStatus(`画布已读取：${saved.canvasId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [canvasId, editor]);

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

  const handleEditorMount = useCallback(
    (mountedEditor: Editor) => {
      setEditor(mountedEditor);
      seedStarterCanvas(mountedEditor, providers[0]?.id);
    },
    [providers]
  );

  return (
    <main className="studio-app-shell">
      <StudioSidebar
        activePage={activePage}
        language={language}
        theme={theme}
        onLanguageToggle={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
        onSwitch={(page) => {
          setActivePage(page);
          setDrawerMode(null);
          setLinkCommandMenu(null);
        }}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />
      <section
        className={`studio-stage ${activePage === "canvas" && isCanvasOpen ? "is-editor" : "is-gate"}`}
        aria-label="Side 工作区"
      >
        {activePage === "canvas" ? (
          <>
            <div className={`studio-canvas-shell ${isCanvasOpen ? "canvas-open" : "no-canvas"}`}>
              {!isCanvasOpen ? (
                <CanvasGate
                  items={canvasItems}
                  onClear={handleClearCanvases}
                  onNew={handleNewCanvas}
                  onOpen={handleOpenCanvas}
                  onRefresh={handleRefreshCanvases}
                />
              ) : (
                <>
                  <CanvasEditorTopbar
                    savedAt={savedAt}
                    status={status}
                    onAddNode={handleAddNode}
                    onClose={() => {
                      setIsCanvasOpen(false);
                      setDrawerMode(null);
                    }}
                    onExport={handleExportSelected}
                    onGroup={handleGroupSelected}
                    onLoad={handleLoadCanvas}
                    onOpenLog={() => setDrawerMode("history")}
                    onOpenNodes={() => setDrawerMode("nodes")}
                    onRun={handleRun}
                    onSave={handleSaveCanvas}
                  />
                  <section className="workspace studio-workspace" aria-label="画布">
                    <CanvasApp onFiles={handleImportFiles} onMount={handleEditorMount} />
                  </section>
                </>
              )}
            </div>
            {isCanvasOpen ? (
              <StudioDrawer
                mode={drawerMode}
                editor={editor}
                providers={providers}
                selectedNode={selectedNode}
                session={session}
                savedAt={savedAt}
                canvasId={canvasId}
                lastRunNodes={lastRunNodes}
                onAddNode={handleAddNode}
                onClose={() => setDrawerMode(null)}
                onConnectMode={handleConnectMode}
                onExport={handleExportSelected}
                onFiles={handleImportFiles}
                onLoad={handleLoadCanvas}
                onProvidersChange={setProviders}
                onSave={handleSaveCanvas}
                onUpdateSelectedNode={handleUpdateSelectedNode}
              />
            ) : null}
            {dragLink ? <LinkDragPreview link={dragLink} /> : null}
            {linkCommandMenu ? (
              <LinkCommandPopover
                menu={linkCommandMenu}
                onClose={() => setLinkCommandMenu(null)}
                onCreate={handleCreateLinkedNode}
              />
            ) : null}
          </>
        ) : activePage === "api-settings" ? (
          <section className="studio-page-frame studio-api-page" aria-label="API 设置">
            <ApiSettings providers={providers} onProvidersChange={setProviders} />
          </section>
        ) : (
          <StudioApiPage pageId={activePage} providers={providers} />
        )}
        <NanoMonitor queue={lastRunNodes.filter((node) => node.status === "running").length} />
      </section>
    </main>
  );
}

function StudioSidebar({
  activePage,
  language,
  theme,
  onLanguageToggle,
  onSwitch,
  onThemeToggle
}: {
  activePage: StudioPageId;
  language: "zh" | "en";
  theme: "dark" | "light";
  onLanguageToggle: () => void;
  onSwitch: (page: StudioPageId) => void;
  onThemeToggle: () => void;
}) {
  return (
    <aside className="studio-sidebar" aria-label="主导航">
      <button className="studio-logo" type="button" aria-label="Side 首页" onClick={() => onSwitch("canvas")}>
        <span />
      </button>
      <nav className="studio-nav">
        {studioNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              className={`studio-nav-item ${isActive ? "is-active" : ""}`}
              type="button"
              key={item.id}
              title={item.label}
              onClick={() => onSwitch(item.id)}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="studio-side-actions" aria-label="辅助操作">
        <button type="button" title="黑夜模式" className={theme === "dark" ? "is-active" : ""} onClick={onThemeToggle}>
          <Sun aria-hidden="true" size={16} />
          <span>{theme === "dark" ? "黑夜模式" : "白天模式"}</span>
        </button>
        <button type="button" title="中文" onClick={onLanguageToggle}>
          <Languages aria-hidden="true" size={16} />
          <span>{language === "zh" ? "中文" : "English"}</span>
        </button>
        <button
          type="button"
          title="API 设置"
          className={activePage === "api-settings" ? "is-active" : ""}
          onClick={() => onSwitch("api-settings")}
        >
          <Link aria-hidden="true" size={16} />
          <span>API 设置</span>
        </button>
      </div>
      <div className="studio-author">Side</div>
    </aside>
  );
}

function StudioApiPage({
  pageId,
  providers
}: {
  pageId: ApiPageKind;
  providers: ApiProvider[];
}) {
  const page = apiPageCopy[pageId];
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [outputs, setOutputs] = useState<Array<{ assetId: string; url: string }>>([]);
  const controls = apiPageControls[pageId];
  const [controlValues, setControlValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(controls.fields.map((field) => [field.key, field.defaultValue]))
  );
  const provider = providers.find((item) => item.primary && item.enabled) ?? providers.find((item) => item.enabled);
  const model =
    pageId === "gpt-chat"
      ? provider?.chatModels[0] ?? ""
      : quickApiNodeType[pageId] === "video"
        ? provider?.videoModels[0] ?? ""
        : provider?.imageModels[0] ?? "gpt-image-2";
  const needsImage = Boolean(controls.uploadLabel);
  const setControl = (key: string, value: string) => {
    setControlValues((current) => ({ ...current, [key]: value }));
  };

  const handleRunQuickTask = async () => {
    setMessage("");
    setOutputs([]);
    if (pageId === "gpt-chat") {
      setMessage("GPT 对话入口已保留，但当前后端还缺 chat runner；需要补 /api/chat 后才能真正发送。");
      return;
    }
    if (needsImage && !file) {
      setMessage("请先选择一张图片。");
      return;
    }
    if (!prompt.trim()) {
      setMessage("请先输入提示词或编辑指令。");
      return;
    }

    setRunning(true);
    try {
      const sessionSeed = file ? await uploadImage(file) : undefined;
      const flow = quickApiFlow({
        pageId,
        prompt,
        negativePrompt,
        params: controlValues,
        providerId: provider?.id,
        model,
        assetId: sessionSeed?.asset.assetId,
        sessionId: sessionSeed?.sessionId
      });
      const result = await executeCanvasFlow(flow);
      setOutputs(result.outputAssets);
      setMessage(result.run.status === "failed" ? result.run.errorMessage ?? "执行失败" : "任务已完成");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="studio-page-frame studio-api-feature" aria-label={page.title}>
      <div className="studio-feature-panel">
        <span className="studio-feature-kicker">{page.kicker}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
        <div className="studio-feature-grid">
          <div className="studio-feature-form">
            {needsImage ? (
              <label className="studio-upload-field">
                <ImagePlus aria-hidden="true" size={18} />
                <span>{file ? file.name : controls.uploadLabel}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            ) : null}
            <label className="studio-form-label">
              {controls.promptLabel}
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={pageId === "gpt-chat" ? "输入对话内容" : "输入提示词或编辑指令"}
              />
            </label>
            <label className="studio-form-label">
              负面提示词
              <input
                value={negativePrompt}
                onChange={(event) => setNegativePrompt(event.target.value)}
                placeholder="可选"
              />
            </label>
            <div className="studio-param-grid">
              {controls.fields.map((field) => (
                <label className="studio-param-field" key={field.key}>
                  <span>{field.label}</span>
                  {field.type === "select" ? (
                    <select value={controlValues[field.key] ?? field.defaultValue} onChange={(event) => setControl(field.key, event.target.value)}>
                      {field.options?.map((option) => (
                        <option value={option} key={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "range" ? (
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={controlValues[field.key] ?? field.defaultValue}
                      onChange={(event) => setControl(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={controlValues[field.key] ?? field.defaultValue}
                      onChange={(event) => setControl(field.key, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
          <aside className="studio-preview-panel">
            <header>
              <strong>{controls.previewTitle}</strong>
              <span>{model || "未选择模型"}</span>
            </header>
            {outputs.length ? (
              <div className="studio-feature-output">
                {outputs.map((output) => (
                  <img src={output.url} alt={output.assetId} key={output.assetId} />
                ))}
              </div>
            ) : (
              <div className="studio-preview-empty">{file ? file.name : "等待提交任务后显示预览"}</div>
            )}
          </aside>
        </div>
        <div className="studio-management-panel">
          <strong>{controls.managementTitle}</strong>
          <span>当前版本 0</span>
          <span>批量队列 0</span>
          <span>历史记录 0</span>
        </div>
        <button type="button" className="studio-feature-primary" disabled={running} onClick={handleRunQuickTask}>
          {running ? <RefreshCw aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          {running ? "提交中" : "提交 API 任务"}
        </button>
        {message ? <div className="studio-feature-message">{message}</div> : null}
      </div>
    </section>
  );
}

function quickApiFlow(input: {
  pageId: ApiPageKind;
  prompt: string;
  negativePrompt: string;
  params?: Record<string, string>;
  providerId?: string;
  model: string;
  assetId?: string;
  sessionId?: string;
}) {
  const now = new Date().toISOString();
  const promptNode = {
    id: "quick_prompt",
    type: "prompt" as const,
    x: 0,
    y: 0,
    width: 280,
    height: 140,
    data: { text: input.prompt }
  };
  const apiNode = {
    id: "quick_api",
    type: quickApiNodeType[input.pageId],
    x: 320,
    y: 0,
    width: 300,
    height: 160,
    data: {
      providerId: input.providerId,
      model: input.model,
      negativePrompt: input.negativePrompt,
      params: input.params,
      baseAssetId: input.assetId,
      maskAssetId: input.pageId === "klein" ? input.assetId : undefined
    }
  };
  const imageNode = input.assetId
    ? {
        id: "quick_image",
        type: "image" as const,
        x: 0,
        y: 180,
        width: 260,
        height: 220,
        data: { assetId: input.assetId }
      }
    : undefined;

  return {
    canvasId: `quick_${input.pageId}_${Date.now().toString(36)}`,
    sessionId: input.sessionId,
    nodes: imageNode ? [promptNode, imageNode, apiNode] : [promptNode, apiNode],
    edges: imageNode
      ? [
          { id: "edge_prompt", from: promptNode.id, to: apiNode.id },
          { id: "edge_image", from: imageNode.id, to: apiNode.id }
        ]
      : [{ id: "edge_prompt", from: promptNode.id, to: apiNode.id }],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now
  };
}
function CanvasGate({
  items,
  onClear,
  onNew,
  onOpen,
  onRefresh
}: {
  items: CanvasGateItem[];
  onClear: () => void;
  onNew: () => void;
  onOpen: (itemId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="canvas-gate" aria-label="选择画布">
      <div className="gate-panel">
        <header className="gate-header">
          <div>
            <h1>
              选择画布 <span>{items.length} 个</span>
            </h1>
            <p>打开已有画布，或新建一个开始创作。</p>
          </div>
          <div className="gate-actions">
            <button type="button" onClick={onRefresh} title="刷新">
              <RefreshCw aria-hidden="true" size={16} />
            </button>
            <button type="button" onClick={onClear} title="清理">
              <Trash2 aria-hidden="true" size={16} />
            </button>
            <button className="gate-new" type="button" onClick={onNew}>
              <Plus aria-hidden="true" size={16} />
              新建画布
            </button>
          </div>
        </header>
        <div className="gate-list">
          {items.map((item) => (
            <button className="gate-canvas-card" type="button" key={item.id} onClick={() => onOpen(item.id)}>
              <span className="gate-card-icon">
                <Layers aria-hidden="true" size={17} />
              </span>
              <strong>{item.title}</strong>
              <small>{formatGateTime(item.updatedAt)}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CanvasEditorTopbar({
  savedAt,
  status,
  onAddNode,
  onClose,
  onExport,
  onGroup,
  onLoad,
  onOpenLog,
  onOpenNodes,
  onRun,
  onSave
}: {
  savedAt: string;
  status: string;
  onAddNode: (type: CanvasNodeKind) => void;
  onClose: () => void;
  onExport: () => void;
  onGroup: () => void;
  onLoad: () => void;
  onOpenLog: () => void;
  onOpenNodes: () => void;
  onRun: () => void;
  onSave: () => void;
}) {
  return (
    <header className="studio-editor-topbar" aria-label="画布操作">
      <button className="canvas-return" type="button" onClick={onClose} title="返回画布列表">
        <Grid3X3 aria-hidden="true" size={16} />
      </button>
      <div className="canvas-title-pill">
        <span className="canvas-preview-mark">
          <Layers aria-hidden="true" size={16} />
        </span>
        <div>
          <strong>当前画布</strong>
          <small>{savedAt ? `已保存 ${savedAt}` : status}</small>
        </div>
      </div>
      <div className="studio-canvas-toolbar" aria-label="节点工具">
        <ToolbarButton title="图片" label="图片" icon={ImagePlus} onClick={() => onAddNode("image")} />
        <ToolbarButton title="提示词" label="提示词" icon={TextCursorInput} onClick={() => onAddNode("prompt")} />
        <ToolbarButton title="循环" label="循环" icon={Repeat2} onClick={() => onAddNode("loop")} />
        <ToolbarButton title="API生成" label="API生成" icon={WandSparkles} onClick={() => onAddNode("api_text2img")} />
        <ToolbarButton title="MS生成" label="MS生成" icon={CloudLightning} onClick={() => onAddNode("api_img2img")} />
        <ToolbarButton title="视频生成" label="视频生成" icon={Clapperboard} onClick={() => onAddNode("video")} />
        <ToolbarButton title="ComfyUI" label="ComfyUI" icon={Workflow} onClick={() => onAddNode("comfy")} />
        <ToolbarButton title="Output" label="Output" icon={CircleDot} onClick={() => onAddNode("output")} />
        <ToolbarButton title="分组" label="分组" icon={Group} onClick={onGroup} />
        <ToolbarButton title="节点面板" label="节点" icon={Braces} onClick={onOpenNodes} />
        <ToolbarButton title="日志" label="日志" icon={ListTodo} onClick={onOpenLog} />
      </div>
    </header>
  );
}

function LinkDragPreview({ link }: { link: DragLink }) {
  const left = Math.min(link.x1, link.x2);
  const top = Math.min(link.y1, link.y2);
  const width = Math.max(1, Math.abs(link.x2 - link.x1));
  const height = Math.max(1, Math.abs(link.y2 - link.y1));
  return (
    <svg
      className="link-drag-preview"
      style={{ left, top, width, height }}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path
        d={`M ${link.x1 <= link.x2 ? 0 : width} ${link.y1 <= link.y2 ? 0 : height} C ${width * 0.45} ${
          link.y1 <= link.y2 ? 0 : height
        }, ${width * 0.55} ${link.y1 <= link.y2 ? height : 0}, ${link.x1 <= link.x2 ? width : 0} ${
          link.y1 <= link.y2 ? height : 0
        }`}
      />
    </svg>
  );
}

function LinkCommandPopover({
  menu,
  onClose,
  onCreate
}: {
  menu: LinkCommandMenu;
  onClose: () => void;
  onCreate: (type: CanvasNodeKind) => void;
}) {
  const options = linkCommandOptions(menu.nodeType);
  return (
    <div className="link-command-popover" style={{ left: menu.clientX, top: menu.clientY }} role="menu">
      <div className="link-command-title">添加下一步</div>
      <div className="link-command-grid">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button type="button" key={option.type} onClick={() => onCreate(option.type)}>
              <Icon aria-hidden="true" size={16} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <button className="link-command-close" type="button" onClick={onClose}>
        取消
      </button>
    </div>
  );
}

function StudioDrawer({
  canvasId,
  editor,
  lastRunNodes,
  mode,
  providers,
  savedAt,
  selectedNode,
  session,
  onAddNode,
  onClose,
  onConnectMode,
  onExport,
  onFiles,
  onLoad,
  onProvidersChange,
  onSave,
  onUpdateSelectedNode
}: {
  canvasId: string;
  editor: Editor | null;
  lastRunNodes: FlowExecutionNode[];
  mode: DrawerMode;
  providers: ApiProvider[];
  savedAt: string;
  selectedNode: SelectedNode | null;
  session: CanvasSession | null;
  onAddNode: (type: CanvasNodeKind) => void;
  onClose: () => void;
  onConnectMode: () => void;
  onExport: () => void;
  onFiles: (files: File[]) => void;
  onLoad: () => void;
  onProvidersChange: (providers: ApiProvider[]) => void;
  onSave: () => void;
  onUpdateSelectedNode: (patch: Record<string, unknown>) => void;
}) {
  if (!mode) {
    return null;
  }

  return (
    <aside className="studio-drawer panel" aria-label="工具抽屉">
      <header className="studio-drawer-head">
        <strong>{drawerTitle(mode)}</strong>
        <button type="button" onClick={onClose} title="鍏抽棴">
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      {mode === "assets" ? <AssetImportPanel disabled={!editor} onFiles={onFiles} /> : null}
      {mode === "nodes" ? <NodePalette disabled={!editor} onAddNode={onAddNode} onConnectMode={onConnectMode} /> : null}
      {mode === "settings" ? (
        <>
          <ApiSettings providers={providers} onProvidersChange={onProvidersChange} />
          <Inspector providers={providers} runNodes={lastRunNodes} selectedNode={selectedNode} onUpdateSelectedNode={onUpdateSelectedNode} />
          <CanvasPersistenceBar canvasId={canvasId} savedAt={savedAt} onLoad={onLoad} onSave={onSave} onExport={onExport} />
        </>
      ) : null}
      {mode === "history" ? <RunHistory session={session} /> : null}
    </aside>
  );
}

function QuickFloat({ onNewCanvas, onOpenSettings }: { onNewCanvas: () => void; onOpenSettings: () => void }) {
  return (
    <div className="studio-quick-float" aria-label="蹇嵎鎿嶄綔">
      <button type="button" onClick={onNewCanvas} title="新建画布">
        <Grid3X3 aria-hidden="true" size={16} />
      </button>
      <button type="button" onClick={onOpenSettings} title="璁剧疆">
        <Settings aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

function NanoMonitor({ queue }: { queue: number }) {
  return (
    <div className="nano-monitor" aria-label="运行状态">
      <span className="online-dot" />
      <b>ONLINE</b>
      <strong>1</strong>
      <b>QUEUE</b>
      <strong>{queue}</strong>
    </div>
  );
}

function IconButton({ icon: Icon, onClick, title }: { icon: LucideIcon; onClick: () => void; title: string }) {
  return (
    <button className="tool-btn" type="button" onClick={onClick} title={title}>
      <Icon aria-hidden="true" size={16} />
    </button>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  title
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button className="tool-btn canvas-tool-btn" type="button" onClick={onClick} title={title}>
      <Icon aria-hidden="true" size={16} />
      <span>{label}</span>
    </button>
  );
}

function linkCommandOptions(nodeType: CanvasNodeKind): Array<{ type: CanvasNodeKind; label: string; icon: LucideIcon }> {
  if (
    nodeType === "api_text2img" ||
    nodeType === "api_img2img" ||
    nodeType === "api_inpaint" ||
    nodeType === "video" ||
    nodeType === "comfy"
  ) {
    return [{ type: "output", label: "Output", icon: Layers }];
  }

  if (nodeType === "output") {
    return [
      { type: "image", label: "图片节点", icon: Image },
      { type: "prompt", label: "提示词", icon: MessageSquare },
      { type: "prompt", label: "提示词", icon: MessageSquareText }
    ];
  }

  return [
    { type: "loop", label: "循环", icon: Repeat2 },
    { type: "api_text2img", label: "文生图", icon: Zap },
    { type: "api_img2img", label: "图生图", icon: Image },
    { type: "api_inpaint", label: "局部重绘", icon: Edit3 },
    { type: "comfy", label: "ComfyUI", icon: Workflow },
    { type: "video", label: "视频生成", icon: Play },
    { type: "output", label: "Output", icon: Layers }
  ];
}

function drawerTitle(mode: Exclude<DrawerMode, null>): string {
  switch (mode) {
    case "assets":
      return "本地素材";
    case "nodes":
      return "节点工具";
    case "settings":
      return "画布控制";
    case "history":
      return "运行记录";
  }
}

function readCanvasGateItems(canvasId: string, reset = false): CanvasGateItem[] {
  const fallback = [
    {
      id: canvasId,
      title: "新建画布 10:18",
      updatedAt: new Date().toISOString()
    },
    {
      id: "c_web_reference_1720",
      title: "新建画布 17:20",
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  if (reset) {
    return fallback.slice(0, 1);
  }

  try {
    const raw = window.localStorage.getItem(CANVAS_LIST_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as CanvasGateItem[];
    return parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function upsertCanvasItem(items: CanvasGateItem[], id: string, title: string, updatedAt: string): CanvasGateItem[] {
  const nextItem = { id, title, updatedAt };
  return [nextItem, ...items.filter((item) => item.id !== id)].slice(0, 8);
}

function formatGateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function seedStarterCanvas(editor: Editor, providerId?: string): void {
  const existingNodes = editor.getCurrentPageShapes().some((shape) => isTshuabuNodeMeta(shape.meta));
  const seeded = window.localStorage.getItem("tshuabu:starterSeeded");
  if (existingNodes || seeded) {
    return;
  }

  const providerData = providerId ? { providerId } : {};
  const nodes = [
    {
      type: "image" as const,
      title: "IMAGE",
      data: { name: "拖入图片素材", roleTag: "素材" },
      width: 260,
      height: 230
    },
    {
      type: "prompt" as const,
      title: "PROMPT",
      data: { text: "输入提示词，连接到生成节点" },
      width: 310,
      height: 190
    },
    {
      type: "api_img2img" as const,
      title: "IMAGE API",
      data: { ...providerData, model: "gpt-image-2", params: { strength: 0.55 } },
      width: 320,
      height: 210
    },
    {
      type: "output" as const,
      title: "OUTPUT",
      data: {},
      width: 360,
      height: 240
    }
  ];

  nodes.forEach((node, index) => {
    addNodeToEditor(editor, node, index);
  });
  editor.selectNone();
  editor.setCamera({ x: 70, y: 76, z: 0.92 });
  window.localStorage.setItem("tshuabu:starterSeeded", "1");
}

function ensureOutputNode(editor: Editor, placementIndexRef: MutableRefObject<number>): void {
  const hasOutputNode = editor
    .getCurrentPageShapes()
    .some((shape) => isTshuabuNodeMeta(shape.meta) && shape.meta.nodeType === "output");
  if (hasOutputNode) {
    return;
  }

  addNodeToEditor(editor, { type: "output", title: "Output", data: {}, width: 460, height: 260 }, placementIndexRef.current);
  placementIndexRef.current += 1;
}

function nodeDefinition(type: CanvasNodeKind, providerId?: string) {
  const providerData = providerId ? { providerId } : {};
  switch (type) {
    case "image":
      return { type, title: "图片节点", data: { assetId: "" }, width: 240, height: 160 };
    case "prompt":
      return { type, title: "Prompt", data: { text: "输入提示词" }, width: 260, height: 130 };
    case "api_text2img":
      return { type, title: "文生图 API", data: { ...providerData, model: "gpt-image-2" }, width: 260, height: 150 };
    case "api_img2img":
      return {
        type,
        title: "图生图 API",
        data: { ...providerData, model: "gpt-image-2", params: { strength: 0.55 } },
        width: 260,
        height: 150
      };
    case "api_inpaint":
      return {
        type,
        title: "局部重绘 API",
        data: { ...providerData, model: "gpt-image-2", maskAssetId: "" },
        width: 260,
        height: 150
      };
    case "loop":
      return { type, title: "循环", data: { count: 4, prompt: "批量变化提示词" }, width: 300, height: 170 };
    case "comfy":
      return { type, title: "ComfyUI", data: { workflow: "", note: "当前按参考入口保留" }, width: 340, height: 210 };
    case "video":
      return { type, title: "视频 API", data: { ...providerData, model: "" }, width: 260, height: 150 };
    case "output":
      return { type, title: "Output", data: {}, width: 260, height: 170 };
    default:
      return { type, title: type, data: {}, width: 260, height: 150 };
  }
}
