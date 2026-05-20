import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "tldraw";
import {
  executeCanvasFlow,
  fetchProviders,
  fetchSession,
  loadCanvasSnapshot,
  saveCanvasSnapshot,
  type ApiProvider,
  type CanvasSession,
  type FlowExecutionNode
} from "./api/client";
import { CanvasApp } from "./canvas/CanvasApp";
import { compileCanvasSnapshot } from "./canvas/flowCompiler";
import type { CanvasNodeKind } from "./canvas/flowTypes";
import {
  addNodeToEditor,
  addOutputImagesToEditor,
  isTshuabuNodeMeta,
  mergeNodeData,
  restoreCanvasSnapshot,
  type TshuabuNodeMeta
} from "./canvas/shapeUtils";
import { ApiSettings } from "./panels/ApiSettings";
import { CanvasPersistenceBar } from "./panels/CanvasPersistenceBar";
import { Inspector } from "./panels/Inspector";
import { NodePalette } from "./panels/NodePalette";
import { RunPanel } from "./panels/RunPanel";
import { RunHistory } from "./panels/RunHistory";

type SelectedNode = {
  id: string;
  meta: TshuabuNodeMeta;
};

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState("等待画布输入");
  const [lastRunNodes, setLastRunNodes] = useState<FlowExecutionNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [session, setSession] = useState<CanvasSession | null>(null);
  const [savedAt, setSavedAt] = useState("");
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

  const handleRun = useCallback(async () => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    try {
      const snapshot = compileCanvasSnapshot(editor, canvasId, session?.sessionId);
      if (snapshot.nodes.length === 0) {
        setStatus("请先添加节点");
        return;
      }

      setStatus(`提交流程：${snapshot.nodes.length} 个节点，${snapshot.edges.length} 条连线`);
      const result = await executeCanvasFlow(snapshot);
      setLastRunNodes(result.nodes);
      const nextSession = await fetchSession(result.sessionId);
      setSession(nextSession);
      addOutputImagesToEditor(editor, result.outputAssets);
      setStatus(`执行完成：${result.nodes.length} 个节点有状态`);
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
      setSavedAt(new Date(saved.updatedAt).toLocaleString());
      setStatus(`画布已保存：${saved.canvasId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [canvasId, editor, session?.sessionId]);

  const handleLoadCanvas = useCallback(async () => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    try {
      const saved = await loadCanvasSnapshot(canvasId);
      restoreCanvasSnapshot(editor, saved);
      setSavedAt(new Date(saved.updatedAt).toLocaleString());
      if (saved.sessionId) {
        setSession(await fetchSession(saved.sessionId));
      }
      setStatus(`画布已读取：${saved.canvasId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [canvasId, editor]);

  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="节点栏">
        <NodePalette disabled={!editor} onAddNode={handleAddNode} onConnectMode={handleConnectMode} />
        <ApiSettings providers={providers} onProvidersChange={setProviders} />
      </aside>
      <section className="workspace" aria-label="画布">
        <CanvasApp onMount={setEditor} />
        <RunPanel onRun={handleRun} status={status} nodeCount={lastRunNodes.length} />
      </section>
      <aside className="side-panel" aria-label="属性栏">
        <Inspector
          providers={providers}
          runNodes={lastRunNodes}
          selectedNode={selectedNode}
          onUpdateSelectedNode={handleUpdateSelectedNode}
        />
        <CanvasPersistenceBar
          canvasId={canvasId}
          savedAt={savedAt}
          onLoad={handleLoadCanvas}
          onSave={handleSaveCanvas}
        />
        <RunHistory session={session} />
      </aside>
    </main>
  );
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
