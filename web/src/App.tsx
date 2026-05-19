import { useCallback, useMemo, useRef, useState } from "react";
import type { Editor } from "tldraw";
import { executeCanvasFlow, type FlowExecutionNode } from "./api/client";
import { CanvasApp } from "./canvas/CanvasApp";
import { compileCanvasSnapshot } from "./canvas/flowCompiler";
import type { CanvasNodeKind } from "./canvas/flowTypes";
import { addNodeToEditor } from "./canvas/shapeUtils";
import { Inspector } from "./panels/Inspector";
import { NodePalette } from "./panels/NodePalette";
import { RunPanel } from "./panels/RunPanel";

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState("等待画布输入");
  const [lastRunNodes, setLastRunNodes] = useState<FlowExecutionNode[]>([]);
  const placementIndexRef = useRef(0);
  const canvasId = useMemo(() => `c_web_${Date.now().toString(36)}`, []);

  const handleAddNode = useCallback(
    (type: CanvasNodeKind) => {
      if (!editor) {
        setStatus("画布还在加载");
        return;
      }

      const definition = nodeDefinition(type);
      addNodeToEditor(editor, definition, placementIndexRef.current);
      placementIndexRef.current += 1;
      setStatus(`已添加 ${definition.title}`);
    },
    [editor]
  );

  const handleConnectMode = useCallback(() => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    editor.setCurrentTool("arrow");
    setStatus("连接模式：从一个节点拖箭头到另一个节点");
  }, [editor]);

  const handleRun = useCallback(async () => {
    if (!editor) {
      setStatus("画布还在加载");
      return;
    }

    try {
      const snapshot = compileCanvasSnapshot(editor, canvasId);
      if (snapshot.nodes.length === 0) {
        setStatus("请先添加节点");
        return;
      }

      setStatus(`提交流程：${snapshot.nodes.length} 个节点，${snapshot.edges.length} 条连线`);
      const result = await executeCanvasFlow(snapshot);
      setLastRunNodes(result.nodes);
      setStatus(`执行完成：${result.nodes.length} 个节点有状态`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [canvasId, editor]);

  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="节点栏">
        <NodePalette disabled={!editor} onAddNode={handleAddNode} onConnectMode={handleConnectMode} />
      </aside>
      <section className="workspace" aria-label="画布">
        <CanvasApp onMount={setEditor} />
        <RunPanel onRun={handleRun} status={status} nodeCount={lastRunNodes.length} />
      </section>
      <aside className="side-panel" aria-label="属性栏">
        <Inspector runNodes={lastRunNodes} />
      </aside>
    </main>
  );
}

function nodeDefinition(type: CanvasNodeKind) {
  switch (type) {
    case "image":
      return { type, title: "图片节点", data: { assetId: "" }, width: 240, height: 160 };
    case "prompt":
      return { type, title: "Prompt", data: { text: "输入提示词" }, width: 260, height: 130 };
    case "api_text2img":
      return { type, title: "文生图 API", data: { model: "fake" }, width: 260, height: 150 };
    case "api_img2img":
      return { type, title: "图生图 API", data: { model: "fake", strength: 0.55 }, width: 260, height: 150 };
    case "api_inpaint":
      return { type, title: "局部重绘 API", data: { model: "fake" }, width: 260, height: 150 };
    case "output":
      return { type, title: "Output", data: {}, width: 260, height: 170 };
    default:
      return { type, title: type, data: {}, width: 260, height: 150 };
  }
}
