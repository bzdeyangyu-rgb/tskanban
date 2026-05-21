import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Editor } from "tldraw";
import {
  Box,
  Download,
  Edit3,
  FolderOpen,
  Globe2,
  Grid3X3,
  Image,
  Languages,
  Layers,
  Link,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sun,
  Trash2,
  Workflow,
  X,
  Zap
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
  addOutputsToOutputNode,
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
import { RunPanel } from "./panels/RunPanel";
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

const CANVAS_LIST_KEY = "tshuabu:canvasGateItems";

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
    fetchProviders()
      .then(setProviders)
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

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

  const handleConnectMode = useCallback(() => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    editor.setCurrentTool("arrow");
    setStatus("连接模式：从一个节点拖箭头到另一个节点");
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
      <StudioSidebar onOpenDrawer={setDrawerMode} activeMode={drawerMode} />
      <section className={`studio-stage ${isCanvasOpen ? "is-editor" : "is-gate"}`} aria-label="Tshuabu 工作区">
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
                onClose={() => {
                  setIsCanvasOpen(false);
                  setDrawerMode(null);
                }}
                onExport={handleExportSelected}
                onLoad={handleLoadCanvas}
                onRun={handleRun}
                onSave={handleSaveCanvas}
              />
              <section className="workspace studio-workspace" aria-label="画布">
                <CanvasApp onFiles={handleImportFiles} onMount={handleEditorMount} />
                <RunPanel onRun={handleRun} status={status} nodeCount={lastRunNodes.length} />
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
        <NanoMonitor queue={lastRunNodes.filter((node) => node.status === "running").length} />
        <QuickFloat onOpenSettings={() => setDrawerMode("settings")} onNewCanvas={handleNewCanvas} />
      </section>
    </main>
  );
}

function StudioSidebar({ activeMode, onOpenDrawer }: { activeMode: DrawerMode; onOpenDrawer: (mode: DrawerMode) => void }) {
  const navItems = [
    { key: "assets" as const, label: "本地素材", icon: Image },
    { key: "nodes" as const, label: "快速生成", icon: Zap },
    { key: "nodes" as const, label: "画笔编辑", icon: Edit3 },
    { key: "nodes" as const, label: "三维参考", icon: Box },
    { key: "settings" as const, label: "在线服务", icon: Globe2 },
    { key: "history" as const, label: "会话记录", icon: MessageSquare },
    { key: "assets" as const, label: "无限画布", icon: Grid3X3 }
  ];

  return (
    <aside className="studio-sidebar" aria-label="主导航">
      <button className="studio-logo" type="button" aria-label="Tshuabu 首页">
        <span />
      </button>
      <nav className="studio-nav">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeMode === item.key || (!activeMode && index === navItems.length - 1);
          return (
            <button
              className={`studio-nav-item ${isActive ? "is-active" : ""}`}
              type="button"
              key={`${item.label}-${index}`}
              title={item.label}
              onClick={() => onOpenDrawer(activeMode === item.key ? null : item.key)}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="studio-side-actions" aria-label="辅助操作">
        <button type="button" title="主题">
          <Sun aria-hidden="true" size={16} />
        </button>
        <button type="button" title="语言">
          <Languages aria-hidden="true" size={16} />
        </button>
        <button type="button" title="API">
          <Link aria-hidden="true" size={16} />
        </button>
        <button type="button" title="ComfyUI">
          <Workflow aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="studio-author">D X</div>
    </aside>
  );
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
  onClose,
  onExport,
  onLoad,
  onRun,
  onSave
}: {
  savedAt: string;
  status: string;
  onClose: () => void;
  onExport: () => void;
  onLoad: () => void;
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
      <div className="studio-editor-actions">
        <IconButton title="运行" onClick={onRun} icon={Play} />
        <IconButton title="保存" onClick={onSave} icon={Save} />
        <IconButton title="读取" onClick={onLoad} icon={FolderOpen} />
        <IconButton title="导出" onClick={onExport} icon={Download} />
      </div>
    </header>
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
        <button type="button" onClick={onClose} title="关闭">
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
    <div className="studio-quick-float" aria-label="快捷操作">
      <button type="button" onClick={onNewCanvas} title="新建画布">
        <Grid3X3 aria-hidden="true" size={16} />
      </button>
      <button type="button" onClick={onOpenSettings} title="设置">
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

function IconButton({ icon: Icon, onClick, title }: { icon: typeof Play; onClick: () => void; title: string }) {
  return (
    <button className="tool-btn" type="button" onClick={onClick} title={title}>
      <Icon aria-hidden="true" size={16} />
    </button>
  );
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
    case "video":
      return { type, title: "视频 API", data: { ...providerData, model: "" }, width: 260, height: 150 };
    case "output":
      return { type, title: "Output", data: {}, width: 260, height: 170 };
    default:
      return { type, title: type, data: {}, width: 260, height: 150 };
  }
}
