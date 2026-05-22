import {
  CircleDot,
  Clapperboard,
  CloudLightning,
  Edit3,
  FileText,
  Group,
  ImagePlus,
  Layers,
  Repeat2,
  WandSparkles,
  Workflow,
  type LucideIcon
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import type { CanvasEdge, CanvasNode, CanvasNodeKind, CanvasNodeStatus, CanvasSnapshot } from "./flowTypes";
import type { NodeDefinition, TshuabuNodeMeta } from "./shapeUtils";

export type ReferenceCanvasHandle = {
  addNode: (definition: NodeDefinition, options?: { x?: number; y?: number; connectFrom?: string }) => string;
  compileSnapshot: (canvasId: string, sessionId?: string) => CanvasSnapshot;
  restoreSnapshot: (snapshot: CanvasSnapshot) => void;
  updateNodeStatuses: (nodes: Array<{ nodeId: string; status: CanvasNodeStatus; errorMessage?: string }>) => void;
  addOutputsToOutputNode: (assets: Array<{ assetId: string; url: string }>) => boolean;
  selectedOutputAsset: () => { assetId: string; url: string } | undefined;
  groupSelected: () => boolean;
  updateSelectedNode: (patch: Record<string, unknown>) => void;
  importImageNode: (nodeId: string, data: Record<string, unknown>) => void;
  hasNodes: () => boolean;
};

type ReferenceCanvasProps = {
  defaultProviderId?: string;
  onFiles: (files: File[]) => void;
  onNodeFiles: (nodeId: string, files: File[]) => void;
  onSelectionChange: (selected: { id: string; meta: TshuabuNodeMeta } | null) => void;
  onStatus: (message: string) => void;
};

type Viewport = { x: number; y: number; zoom: number };
type CreateMenu = { fromId: string; x: number; y: number; canvasX: number; canvasY: number; fromType: CanvasNodeKind };
type DragLink = { fromId: string; fromType: CanvasNodeKind; x1: number; y1: number; x2: number; y2: number };
type DragState =
  | { type: "node"; id: string; startX: number; startY: number; nodes: Array<{ id: string; x: number; y: number }> }
  | { type: "resize"; id: string; startX: number; startY: number; x: number; y: number; width: number; height: number }
  | { type: "pan"; startX: number; startY: number; x: number; y: number };

const MIN_NODE_WIDTH = 220;
const MIN_NODE_HEIGHT = 126;

export const ReferenceCanvas = forwardRef<ReferenceCanvasHandle, ReferenceCanvasProps>(function ReferenceCanvas(
  { defaultProviderId, onFiles, onNodeFiles, onSelectionChange, onStatus },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const nodeCounterRef = useRef(0);
  const edgeCounterRef = useRef(0);
  const [nodes, setNodes] = useState<CanvasNode[]>(() => starterNodes(defaultProviderId));
  const [edges, setEdges] = useState<CanvasEdge[]>(starterEdges());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 80, y: 80, zoom: 0.92 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragLink, setDragLink] = useState<DragLink | null>(null);
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedIds[0]), [nodes, selectedIds]);

  useEffect(() => {
    if (!selectedNode) {
      onSelectionChange(null);
      return;
    }
    onSelectionChange({
      id: selectedNode.id,
      meta: nodeMeta(selectedNode)
    });
  }, [onSelectionChange, selectedNode]);

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = hostRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      return {
        x: (clientX - left - viewport.x) / viewport.zoom,
        y: (clientY - top - viewport.y) / viewport.zoom
      };
    },
    [viewport]
  );

  const addNode = useCallback(
    (definition: NodeDefinition, options?: { x?: number; y?: number; connectFrom?: string }) => {
      const id = `node_${Date.now().toString(36)}_${nodeCounterRef.current++}`;
      const fallbackX = 80 + (nodeCounterRef.current % 3) * 320;
      const fallbackY = 90 + Math.floor(nodeCounterRef.current / 3) * 220;
      const node: CanvasNode = {
        id,
        type: definition.type,
        x: options?.x ?? fallbackX,
        y: options?.y ?? fallbackY,
        width: definition.width ?? 280,
        height: definition.height ?? 170,
        data: definition.data ?? {},
        status: "idle"
      };
      setNodes((current) => [...current, node]);
      if (options?.connectFrom) {
        setEdges((current) => [
          ...current,
          {
            id: `edge_${Date.now().toString(36)}_${edgeCounterRef.current++}`,
            from: options.connectFrom!,
            to: id
          }
        ]);
      }
      setSelectedIds([id]);
      return id;
    },
    []
  );

  const patchNode = useCallback((nodeId: string, patch: Partial<CanvasNode>) => {
    setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)));
  }, []);

  const updateNodeData = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node))
    );
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) {
      return;
    }
    const selected = new Set(selectedIds);
    setNodes((current) => current.filter((node) => !selected.has(node.id)));
    setEdges((current) => current.filter((edge) => !selected.has(edge.from) && !selected.has(edge.to)));
    setSelectedIds([]);
    onStatus(`已删除 ${selectedIds.length} 个节点`);
  }, [onStatus, selectedIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }
      event.preventDefault();
      deleteSelected();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected]);

  useEffect(() => {
    if (!dragState && !dragLink) {
      return undefined;
    }

    const handleMove = (event: PointerEvent) => {
      if (dragState?.type === "node") {
        const dx = (event.clientX - dragState.startX) / viewport.zoom;
        const dy = (event.clientY - dragState.startY) / viewport.zoom;
        setNodes((current) =>
          current.map((node) => {
            const start = dragState.nodes.find((item) => item.id === node.id);
            return start ? { ...node, x: start.x + dx, y: start.y + dy } : node;
          })
        );
      }

      if (dragState?.type === "resize") {
        const dx = (event.clientX - dragState.startX) / viewport.zoom;
        const dy = (event.clientY - dragState.startY) / viewport.zoom;
        setNodes((current) =>
          current.map((node) =>
            node.id === dragState.id
              ? {
                  ...node,
                  x: dragState.x + Math.min(dx, dragState.width - MIN_NODE_WIDTH),
                  y: dragState.y,
                  width: Math.max(MIN_NODE_WIDTH, dragState.width - dx),
                  height: Math.max(MIN_NODE_HEIGHT, dragState.height + dy)
                }
              : node
          )
        );
      }

      if (dragState?.type === "pan") {
        setViewport((current) => ({
          ...current,
          x: dragState.x + event.clientX - dragState.startX,
          y: dragState.y + event.clientY - dragState.startY
        }));
      }

      if (dragLink) {
        setDragLink((current) => (current ? { ...current, x2: event.clientX, y2: event.clientY } : current));
      }
    };

    const handleUp = (event: PointerEvent) => {
      if (dragLink) {
        const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        const targetNodeId = target?.closest<HTMLElement>("[data-reference-node-id]")?.dataset.referenceNodeId;
        if (targetNodeId && targetNodeId !== dragLink.fromId) {
          setEdges((current) => [
            ...current.filter((edge) => !(edge.from === dragLink.fromId && edge.to === targetNodeId)),
            { id: `edge_${Date.now().toString(36)}_${edgeCounterRef.current++}`, from: dragLink.fromId, to: targetNodeId }
          ]);
          onStatus("已建立节点连线");
        } else {
          const point = screenToCanvas(event.clientX, event.clientY);
          setCreateMenu({
            fromId: dragLink.fromId,
            fromType: dragLink.fromType,
            x: event.clientX,
            y: event.clientY,
            canvasX: point.x,
            canvasY: point.y
          });
        }
      }
      setDragState(null);
      setDragLink(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragLink, dragState, onStatus, screenToCanvas, viewport.zoom]);

  useImperativeHandle(
    ref,
    (): ReferenceCanvasHandle => ({
      addNode,
      compileSnapshot: (canvasId, sessionId) => ({
        canvasId,
        sessionId,
        nodes,
        edges,
        viewport,
        selectedNodeId: selectedIds[0],
        updatedAt: new Date().toISOString()
      }),
      restoreSnapshot: (snapshot) => {
        setNodes(snapshot.nodes);
        setEdges(snapshot.edges);
        setViewport(snapshot.viewport ?? { x: 80, y: 80, zoom: 1 });
        setSelectedIds(snapshot.selectedNodeId ? [snapshot.selectedNodeId] : []);
      },
      updateNodeStatuses: (runNodes) => {
        setNodes((current) =>
          current.map((node) => {
            const next = runNodes.find((item) => item.nodeId === node.id);
            if (!next) {
              return node;
            }
            return {
              ...node,
              status: next.status,
              data: next.errorMessage ? { ...node.data, errorMessage: next.errorMessage } : node.data
            };
          })
        );
      },
      addOutputsToOutputNode: (assets) => {
        if (assets.length === 0) {
          return false;
        }
        const output = nodes.find((node) => node.type === "output");
        if (!output) {
          return false;
        }
        const existing = Array.isArray(output.data.outputs) ? output.data.outputs : [];
        const seen = new Set(existing.map((item) => (isOutputAsset(item) ? item.assetId : "")));
        const nextOutputs = [...existing];
        assets.forEach((asset) => {
          if (!seen.has(asset.assetId)) {
            nextOutputs.push(asset);
            seen.add(asset.assetId);
          }
        });
        setNodes((current) =>
          current.map((node) =>
            node.id === output.id ? { ...node, status: "success", data: { ...node.data, outputs: nextOutputs } } : node
          )
        );
        setSelectedIds([output.id]);
        return true;
      },
      selectedOutputAsset: () => {
        const output = nodes.find((node) => node.id === selectedIds[0] && node.type === "output");
        const outputs = Array.isArray(output?.data.outputs) ? output.data.outputs : [];
        const last = outputs[outputs.length - 1];
        return isOutputAsset(last) ? last : undefined;
      },
      groupSelected: () => {
        if (selectedIds.length < 2) {
          return false;
        }
        const picked = nodes.filter((node) => selectedIds.includes(node.id));
        const left = Math.min(...picked.map((node) => node.x)) - 22;
        const top = Math.min(...picked.map((node) => node.y)) - 28;
        const right = Math.max(...picked.map((node) => node.x + node.width)) + 22;
        const bottom = Math.max(...picked.map((node) => node.y + node.height)) + 22;
        addNode(
          {
            type: "group" as CanvasNodeKind,
            title: "分组",
            data: { childIds: selectedIds },
            width: right - left,
            height: bottom - top
          },
          { x: left, y: top }
        );
        return true;
      },
      updateSelectedNode: (patch) => {
        if (selectedIds[0]) {
          updateNodeData(selectedIds[0], patch);
        }
      },
      importImageNode: (nodeId, data) => updateNodeData(nodeId, data),
      hasNodes: () => nodes.length > 0
    }),
    [addNode, edges, nodes, selectedIds, updateNodeData, viewport]
  );

  const handleHostPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setCreateMenu(null);
    setSelectedIds([]);
    setDragState({ type: "pan", startX: event.clientX, startY: event.clientY, x: viewport.x, y: viewport.y });
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    const nextZoom = clamp(viewport.zoom - event.deltaY * 0.001, 0.35, 1.6);
    setViewport((current) => ({ ...current, zoom: nextZoom }));
  };

  return (
    <div
      ref={hostRef}
      className="reference-canvas"
      onPointerDown={handleHostPointerDown}
      onWheel={handleWheel}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <svg className="reference-links" aria-hidden="true">
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {edges.map((edge) => {
            const from = nodes.find((node) => node.id === edge.from);
            const to = nodes.find((node) => node.id === edge.to);
            if (!from || !to) {
              return null;
            }
            return <path d={linkPath(from, to)} key={edge.id} />;
          })}
        </g>
      </svg>
      <div
        className="reference-canvas-plane"
        style={{ "--canvas-x": `${viewport.x}px`, "--canvas-y": `${viewport.y}px`, "--canvas-z": viewport.zoom } as CSSProperties}
      >
        {nodes.map((node) => (
          <ReferenceNodeCard
            key={node.id}
            node={node}
            selected={selectedIds.includes(node.id)}
            onData={updateNodeData}
            onFiles={(files) => onNodeFiles(node.id, files)}
            onLinkStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const start = nodePortPoint(node);
              const rect = hostRef.current?.getBoundingClientRect();
              setDragLink({
                fromId: node.id,
                fromType: node.type,
                x1: (rect?.left ?? 0) + viewport.x + start.x * viewport.zoom,
                y1: (rect?.top ?? 0) + viewport.y + start.y * viewport.zoom,
                x2: event.clientX,
                y2: event.clientY
              });
            }}
            onSelect={(event) => {
              event.stopPropagation();
              setCreateMenu(null);
              setSelectedIds((current) =>
                event.ctrlKey || event.metaKey
                  ? current.includes(node.id)
                    ? current.filter((id) => id !== node.id)
                    : [...current, node.id]
                  : [node.id]
              );
            }}
            onDragStart={(event) => {
              event.stopPropagation();
              const ids = selectedIds.includes(node.id) ? selectedIds : [node.id];
              setSelectedIds(ids);
              setDragState({
                type: "node",
                id: node.id,
                startX: event.clientX,
                startY: event.clientY,
                nodes: nodes.filter((item) => ids.includes(item.id)).map((item) => ({ id: item.id, x: item.x, y: item.y }))
              });
            }}
            onResizeStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelectedIds([node.id]);
              setDragState({
                type: "resize",
                id: node.id,
                startX: event.clientX,
                startY: event.clientY,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height
              });
            }}
          />
        ))}
      </div>
      {dragLink ? <LinkPreview link={dragLink} /> : null}
      {createMenu ? (
        <CreateNodeMenu
          menu={createMenu}
          onClose={() => setCreateMenu(null)}
          onCreate={(type) => {
            addNode(nodeDefinition(type, defaultProviderId), {
              x: createMenu.canvasX + 24,
              y: createMenu.canvasY - 72,
              connectFrom: createMenu.fromId
            });
            setCreateMenu(null);
          }}
        />
      ) : null}
    </div>
  );
});

function ReferenceNodeCard({
  node,
  onData,
  onDragStart,
  onFiles,
  onLinkStart,
  onResizeStart,
  onSelect,
  selected
}: {
  node: CanvasNode;
  onData: (nodeId: string, patch: Record<string, unknown>) => void;
  onDragStart: (event: ReactPointerEvent) => void;
  onFiles: (files: File[]) => void;
  onLinkStart: (event: ReactPointerEvent) => void;
  onResizeStart: (event: ReactPointerEvent) => void;
  onSelect: (event: ReactPointerEvent) => void;
  selected: boolean;
}) {
  const Icon = nodeIcon(node.type);
  const style = {
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height
  };

  return (
    <article
      className={`reference-node reference-node-${node.type} ${selected ? "is-selected" : ""} ${node.status ?? "idle"}`}
      data-reference-node-id={node.id}
      style={style}
      onPointerDown={onSelect}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <header className="reference-node-head" onPointerDown={onDragStart}>
        <span className="reference-node-icon">
          <Icon aria-hidden="true" size={16} />
        </span>
        <strong>{nodeTitle(node.type)}</strong>
        <small>{node.status ?? "idle"}</small>
      </header>
      <div className="reference-node-body">{renderNodeBody(node, onData, onFiles)}</div>
      {node.type !== "output" && node.type !== ("group" as CanvasNodeKind) ? (
        <button className="reference-node-port" type="button" title="拖出连线" onPointerDown={onLinkStart} />
      ) : null}
      <button className="reference-node-resize" type="button" title="调整节点大小" onPointerDown={onResizeStart} />
    </article>
  );
}

function renderNodeBody(
  node: CanvasNode,
  onData: (nodeId: string, patch: Record<string, unknown>) => void,
  onFiles: (files: File[]) => void
) {
  if (node.type === "image") {
    const url = stringValue(node.data.url);
    return (
      <label className="reference-image-drop">
        {url ? <img src={url} alt={stringValue(node.data.name) || "image"} /> : <span>点击或拖入图片</span>}
        <input type="file" accept="image/*" onChange={(event) => onFiles(Array.from(event.target.files ?? []))} />
      </label>
    );
  }

  if (node.type === "prompt") {
    const value = stringValue(node.data.text);
    return (
      <label className="reference-prompt-field">
        <textarea value={value} placeholder="输入提示词" onChange={(event) => onData(node.id, { text: event.target.value })} />
        <small>{value.length} 字</small>
      </label>
    );
  }

  if (node.type === "loop") {
    return (
      <div className="reference-node-form">
        <label>
          循环次数
          <input
            type="number"
            min="1"
            value={stringValue(node.data.count) || "4"}
            onChange={(event) => onData(node.id, { count: Number(event.target.value) })}
          />
        </label>
        <label>
          变化提示
          <textarea value={stringValue(node.data.prompt)} onChange={(event) => onData(node.id, { prompt: event.target.value })} />
        </label>
      </div>
    );
  }

  if (node.type === "output") {
    const outputs = Array.isArray(node.data.outputs) ? node.data.outputs.filter(isOutputAsset) : [];
    return outputs.length ? (
      <div className="reference-output-grid">
        {outputs.map((asset) => (
          <img src={asset.url} alt={asset.assetId} key={asset.assetId} />
        ))}
      </div>
    ) : (
      <div className="reference-empty">等待生成结果</div>
    );
  }

  if (node.type === ("group" as CanvasNodeKind)) {
    return <div className="reference-group-label">已分组 {Array.isArray(node.data.childIds) ? node.data.childIds.length : 0} 个节点</div>;
  }

  return (
    <div className="reference-node-form">
      <label>
        模型
        <input value={stringValue(node.data.model)} onChange={(event) => onData(node.id, { model: event.target.value })} />
      </label>
      <label>
        提示词覆盖
        <textarea value={stringValue(node.data.prompt)} onChange={(event) => onData(node.id, { prompt: event.target.value })} />
      </label>
      <label>
        负面提示词
        <textarea
          value={stringValue(node.data.negativePrompt)}
          onChange={(event) => onData(node.id, { negativePrompt: event.target.value })}
        />
      </label>
    </div>
  );
}

function CreateNodeMenu({
  menu,
  onClose,
  onCreate
}: {
  menu: CreateMenu;
  onClose: () => void;
  onCreate: (type: CanvasNodeKind) => void;
}) {
  return (
    <div className="reference-create-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <div className="reference-create-title">添加下一步</div>
      <div className="reference-create-grid">
        {linkOptions(menu.fromType).map((option) => {
          const Icon = option.icon;
          return (
            <button type="button" key={option.type} onClick={() => onCreate(option.type)}>
              <Icon aria-hidden="true" size={17} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <button className="reference-create-close" type="button" onClick={onClose}>
        取消
      </button>
    </div>
  );
}

function LinkPreview({ link }: { link: DragLink }) {
  const left = Math.min(link.x1, link.x2);
  const top = Math.min(link.y1, link.y2);
  const width = Math.max(1, Math.abs(link.x2 - link.x1));
  const height = Math.max(1, Math.abs(link.y2 - link.y1));
  return (
    <svg className="reference-link-preview" style={{ left, top, width, height }} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M ${link.x1 <= link.x2 ? 0 : width} ${link.y1 <= link.y2 ? 0 : height} C ${width * 0.45} 0, ${width * 0.55} ${height}, ${link.x1 <= link.x2 ? width : 0} ${link.y1 <= link.y2 ? height : 0}`} />
    </svg>
  );
}

function starterNodes(providerId?: string): CanvasNode[] {
  const providerData = providerId ? { providerId } : {};
  return [
    { id: "starter_image", type: "image", x: 80, y: 110, width: 280, height: 250, data: { name: "拖入图片素材" }, status: "idle" },
    { id: "starter_prompt", type: "prompt", x: 420, y: 110, width: 330, height: 210, data: { text: "输入提示词，连接到生成节点。" }, status: "idle" },
    {
      id: "starter_api",
      type: "api_img2img",
      x: 810,
      y: 120,
      width: 330,
      height: 230,
      data: { ...providerData, model: "gpt-image-2", params: { strength: 0.55 } },
      status: "idle"
    },
    { id: "starter_output", type: "output", x: 1210, y: 120, width: 360, height: 250, data: {}, status: "idle" }
  ];
}

function starterEdges(): CanvasEdge[] {
  return [
    { id: "starter_edge_prompt", from: "starter_prompt", to: "starter_api" },
    { id: "starter_edge_image", from: "starter_image", to: "starter_api" },
    { id: "starter_edge_output", from: "starter_api", to: "starter_output" }
  ];
}

function nodeDefinition(type: CanvasNodeKind, providerId?: string): NodeDefinition {
  const providerData = providerId ? { providerId } : {};
  switch (type) {
    case "image":
      return { type, title: "图片", data: {}, width: 280, height: 240 };
    case "prompt":
      return { type, title: "提示词", data: { text: "" }, width: 320, height: 210 };
    case "loop":
      return { type, title: "循环", data: { count: 4, prompt: "" }, width: 300, height: 200 };
    case "api_img2img":
      return { type, title: "MS生成", data: { ...providerData, model: "gpt-image-2" }, width: 330, height: 230 };
    case "api_inpaint":
      return { type, title: "局部重绘", data: { ...providerData, model: "gpt-image-2" }, width: 330, height: 230 };
    case "video":
      return { type, title: "视频生成", data: { ...providerData, model: "" }, width: 330, height: 220 };
    case "comfy":
      return { type, title: "ComfyUI", data: { workflow: "" }, width: 340, height: 230 };
    case "output":
      return { type, title: "Output", data: {}, width: 360, height: 250 };
    case "api_text2img":
    default:
      return { type: "api_text2img", title: "API生成", data: { ...providerData, model: "gpt-image-2" }, width: 330, height: 230 };
  }
}

function nodeMeta(node: CanvasNode): TshuabuNodeMeta {
  return {
    kind: "tshuabu-node",
    nodeType: node.type,
    title: nodeTitle(node.type),
    data: node.data,
    status: node.status
  };
}

function linkPath(from: CanvasNode, to: CanvasNode): string {
  const start = nodePortPoint(from);
  const end = { x: to.x, y: to.y + to.height / 2 };
  const dx = Math.max(80, Math.abs(end.x - start.x) * 0.42);
  return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
}

function nodePortPoint(node: CanvasNode): { x: number; y: number } {
  return { x: node.x + node.width, y: node.y + node.height / 2 };
}

function linkOptions(type: CanvasNodeKind): Array<{ type: CanvasNodeKind; label: string; icon: LucideIcon }> {
  if (["api_text2img", "api_img2img", "api_inpaint", "video", "comfy"].includes(type)) {
    return [{ type: "output", label: "Output", icon: CircleDot }];
  }
  return [
    { type: "prompt", label: "提示词", icon: FileText },
    { type: "loop", label: "循环", icon: Repeat2 },
    { type: "api_text2img", label: "API生成", icon: WandSparkles },
    { type: "api_img2img", label: "MS生成", icon: CloudLightning },
    { type: "video", label: "视频", icon: Clapperboard },
    { type: "output", label: "Output", icon: CircleDot }
  ];
}

function nodeIcon(type: CanvasNodeKind): LucideIcon {
  const icons: Partial<Record<CanvasNodeKind, LucideIcon>> = {
    image: ImagePlus,
    prompt: FileText,
    loop: Repeat2,
    api_text2img: WandSparkles,
    api_img2img: CloudLightning,
    api_inpaint: Edit3,
    video: Clapperboard,
    comfy: Workflow,
    output: CircleDot,
    group: Group as LucideIcon
  };
  return icons[type] ?? Layers;
}

function nodeTitle(type: CanvasNodeKind): string {
  const titles: Partial<Record<CanvasNodeKind, string>> = {
    image: "图片",
    prompt: "提示词",
    loop: "循环",
    api_text2img: "API生成",
    api_img2img: "MS生成",
    api_inpaint: "局部重绘",
    video: "视频生成",
    comfy: "ComfyUI",
    output: "Output",
    group: "分组"
  };
  return titles[type] ?? type;
}

function stringValue(value: unknown): string {
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

function isOutputAsset(value: unknown): value is { assetId: string; url: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { assetId?: unknown }).assetId === "string" &&
      typeof (value as { url?: unknown }).url === "string"
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
