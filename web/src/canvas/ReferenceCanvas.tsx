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
  X,
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

export type WorkflowGeneScope = "selection" | "selectionWithOutputs" | "canvas";

export type ReferenceCanvasHandle = {
  addNode: (definition: NodeDefinition, options?: { x?: number; y?: number; connectFrom?: string }) => string;
  compileSnapshot: (canvasId: string, sessionId?: string) => CanvasSnapshot;
  restoreSnapshot: (snapshot: CanvasSnapshot) => void;
  importWorkflowGene: (snapshot: CanvasSnapshot) => number;
  updateNodeStatuses: (nodes: Array<{ nodeId: string; status: CanvasNodeStatus; errorMessage?: string }>) => void;
  addOutputsToOutputNode: (assets: Array<{ assetId: string; url: string }>, sourceNodeId?: string) => boolean;
  selectedOutputAsset: () => { assetId: string; url: string } | undefined;
  groupSelected: () => boolean;
  updateSelectedNode: (patch: Record<string, unknown>) => void;
  importImageNode: (nodeId: string, data: Record<string, unknown>) => void;
  promptGeneSource: () => { prompt: string; sourceNodeId: string } | undefined;
  workflowGeneSource: (scope?: WorkflowGeneScope) => { snapshot: CanvasSnapshot; nodeCount: number } | undefined;
  hasNodes: () => boolean;
};

type ReferenceCanvasProps = {
  defaultProviderId?: string;
  onFiles: (files: File[]) => void;
  onNodeFiles: (nodeId: string, files: File[]) => void;
  onRunNode: (nodeId: string) => void;
  onSelectionChange: (selected: { id: string; meta: TshuabuNodeMeta } | null) => void;
  onStatus: (message: string) => void;
};

type Viewport = { x: number; y: number; zoom: number };
type CreateMenu = { fromId: string; x: number; y: number; canvasX: number; canvasY: number; fromType: CanvasNodeKind };
type DragLink = { fromId: string; fromType: CanvasNodeKind; x1: number; y1: number; x2: number; y2: number };
type DragState =
  | { type: "node"; id: string; startX: number; startY: number; ids: string[]; nodes: CanvasNode[] }
  | { type: "resize"; id: string; startX: number; startY: number; x: number; y: number; width: number; height: number }
  | { type: "pan"; startX: number; startY: number; x: number; y: number }
  | { type: "select"; startX: number; startY: number; currentX: number; currentY: number };

const MIN_NODE_WIDTH = 220;
const MIN_NODE_HEIGHT = 126;

export const ReferenceCanvas = forwardRef<ReferenceCanvasHandle, ReferenceCanvasProps>(function ReferenceCanvas(
  { defaultProviderId, onFiles, onNodeFiles, onRunNode, onSelectionChange, onStatus },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const nodeCounterRef = useRef(0);
  const edgeCounterRef = useRef(0);
  const [nodes, setNodes] = useState<CanvasNode[]>(() => starterNodes(defaultProviderId));
  const [edges, setEdges] = useState<CanvasEdge[]>(starterEdges());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 80, y: 80, zoom: 0.92 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragLink, setDragLink] = useState<DragLink | null>(null);
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedIds[0]), [nodes, selectedIds]);
  const edgeActions = useMemo(
    () =>
      edges.flatMap((edge) => {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        if (!from || !to) {
          return [];
        }
        return [
          {
            edgeId: edge.id,
            ...edgeActionPosition(from, to, viewport)
          }
        ];
      }),
    [edges, nodes, viewport]
  );

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

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      onStatus("\u5df2\u5220\u9664 1 \u6761\u8fde\u7ebf");
    },
    [onStatus]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0 && !selectedEdgeId) {
      return;
    }
    const deletedNodeCount = selectedIds.length;
    setNodes((currentNodes) => {
      const result = deleteCanvasSelection(currentNodes, edges, selectedIds, selectedEdgeId);
      setEdges(result.edges);
      return result.nodes;
    });
    setSelectedIds([]);
    setSelectedEdgeId(null);
    onStatus(selectedEdgeId ? "\u5df2\u5220\u9664 1 \u6761\u8fde\u7ebf" : `\u5df2\u5220\u9664 ${deletedNodeCount} \u4e2a\u8282\u70b9`);
  }, [edges, onStatus, selectedEdgeId, selectedIds]);

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
        setNodes(moveCanvasNodes(dragState.nodes, dragState.ids, dx, dy));
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

      if (dragState?.type === "select") {
        setDragState((current) =>
          current?.type === "select" ? { ...current, currentX: event.clientX, currentY: event.clientY } : current
        );
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
      if (dragState?.type === "select") {
        const start = screenToCanvas(dragState.startX, dragState.startY);
        const end = screenToCanvas(event.clientX, event.clientY);
        const rect = normalizedRect(start.x, start.y, end.x, end.y);
        const picked = nodes.filter((node) => rectIntersectsNode(rect, node)).map((node) => node.id);
        setSelectedIds(picked);
        onStatus(picked.length > 0 ? `已框选 ${picked.length} 个节点` : "未框选到节点");
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
      importWorkflowGene: (snapshot) => {
        const rect = hostRef.current?.getBoundingClientRect();
        const targetCenter = {
          x: ((rect?.width ?? 1200) / 2 - viewport.x) / viewport.zoom,
          y: ((rect?.height ?? 800) / 2 - viewport.y) / viewport.zoom
        };
        const result = importWorkflowGeneToCanvas(nodes, edges, snapshot, `gene_${Date.now().toString(36)}_${nodeCounterRef.current++}`, {
          targetCenter,
          avoidOverlap: true
        });
        setNodes(result.nodes);
        setEdges(result.edges);
        setSelectedIds(result.importedIds);
        return result.importedIds.length;
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
      addOutputsToOutputNode: (assets, sourceNodeId) => {
        if (assets.length === 0) {
          return false;
        }
        const output = outputNodeForAssets(nodes, edges, sourceNodeId);
        if (!output) {
          return false;
        }
        const existing = Array.isArray(output.data.outputs) ? output.data.outputs.filter(isOutputAsset) : [];
        const nextOutputs = mergeOutputAssets(existing, assets);
        setNodes((current) =>
          current.map((node) =>
            node.id === output.id
              ? { ...node, status: "success", data: { ...node.data, outputs: nextOutputs, selectedOutputAssetId: assets[0]?.assetId } }
              : node
          )
        );
        setSelectedIds([output.id]);
        return true;
      },
      selectedOutputAsset: () => {
        const output = nodes.find((node) => node.id === selectedIds[0] && node.type === "output");
        return selectedOutputAssetFromNode(output);
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
      promptGeneSource: () => promptGeneSourceFromNodes(nodes, selectedIds),
      workflowGeneSource: (scope) => workflowGeneSourceFromSelection(nodes, edges, selectedIds, scope),
      hasNodes: () => nodes.length > 0
    }),
    [addNode, edges, nodes, selectedIds, updateNodeData, viewport]
  );

  const handleHostPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-reference-node-id], .reference-create-menu, button, input, textarea, select")) {
      return;
    }
    setCreateMenu(null);
    setSelectedEdgeId(null);
    if (event.ctrlKey || event.metaKey) {
      setDragState({
        type: "select",
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY
      });
      return;
    }
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
            return (
              <path
                className={selectedEdgeId === edge.id ? "is-selected" : ""}
                d={linkPath(from, to)}
                key={edge.id}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setCreateMenu(null);
                  setSelectedIds([]);
                  setSelectedEdgeId(edge.id);
                }}
                onPointerEnter={() => setHoveredEdgeId(edge.id)}
                onPointerLeave={() => setHoveredEdgeId((current) => (current === edge.id ? null : current))}
              />
            );
          })}
        </g>
      </svg>
      {edgeActions.map((edgeAction) => (
        <button
          aria-label={"\u5220\u9664\u8fde\u7ebf"}
          className={[
            "reference-edge-delete",
            selectedEdgeId === edgeAction.edgeId ? "is-selected" : "",
            hoveredEdgeId === edgeAction.edgeId ? "is-hovered" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          key={edgeAction.edgeId}
          style={{ left: edgeAction.x, top: edgeAction.y }}
          title={"\u5220\u9664\u8fde\u7ebf"}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            deleteEdge(edgeAction.edgeId);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedIds([]);
            setSelectedEdgeId(edgeAction.edgeId);
          }}
          onPointerEnter={() => setHoveredEdgeId(edgeAction.edgeId)}
          onPointerLeave={() => {
            setHoveredEdgeId((current) => (current === edgeAction.edgeId ? null : current));
          }}
        >
          <X size={13} strokeWidth={3} />
        </button>
      ))}
      <div
        className="reference-canvas-plane"
        style={{ "--canvas-x": `${viewport.x}px`, "--canvas-y": `${viewport.y}px`, "--canvas-z": viewport.zoom } as CSSProperties}
      >
        {nodes.map((node) => (
          <ReferenceNodeCard
            key={node.id}
            node={node}
            selected={selectedIds.includes(node.id)}
            upstreamNodes={upstreamNodesFor(nodes, edges, node.id)}
            onData={updateNodeData}
            onFiles={(files) => onNodeFiles(node.id, files)}
            onImageFromAsset={(asset) => {
              const imageId = addNode(
                {
                  type: "image",
                  title: "图片节点",
                  data: { assetId: asset.assetId, url: asset.url, name: asset.assetId, roleTag: "输出回填" },
                  width: 280,
                  height: 260
                },
                { x: node.x + node.width + 36, y: node.y }
              );
              setEdges((current) => [
                ...current,
                { id: `edge_${Date.now().toString(36)}_${edgeCounterRef.current++}`, from: node.id, to: imageId }
              ]);
              onStatus(`已回填 ${asset.assetId} 为图片节点`);
            }}
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
              setSelectedEdgeId(null);
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
              const dragIds = collectDragNodeIds(nodes, ids, node.id);
              setSelectedIds(ids);
              setDragState({
                type: "node",
                id: node.id,
                startX: event.clientX,
                startY: event.clientY,
                ids: dragIds,
                nodes
              });
            }}
            onRunNode={() => onRunNode(node.id)}
            hasConnectedOutput={hasConnectedOutput(nodes, edges, node.id)}
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
      {dragState?.type === "select" ? <SelectionBox selection={dragState} /> : null}
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
  hasConnectedOutput,
  onData,
  onDragStart,
  onFiles,
  onImageFromAsset,
  onLinkStart,
  onResizeStart,
  onRunNode,
  onSelect,
  selected,
  upstreamNodes
}: {
  node: CanvasNode;
  hasConnectedOutput: boolean;
  onData: (nodeId: string, patch: Record<string, unknown>) => void;
  onDragStart: (event: ReactPointerEvent) => void;
  onFiles: (files: File[]) => void;
  onImageFromAsset: (asset: { assetId: string; url: string }) => void;
  onLinkStart: (event: ReactPointerEvent) => void;
  onResizeStart: (event: ReactPointerEvent) => void;
  onRunNode: () => void;
  onSelect: (event: ReactPointerEvent) => void;
  selected: boolean;
  upstreamNodes: CanvasNode[];
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
      onDragOver={(event) => {
        if (node.type === "image") {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (node.type !== "image") {
          return;
        }
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
      <div className="reference-node-body">{renderNodeBody(node, upstreamNodes, onData, onFiles, onRunNode, onImageFromAsset, hasConnectedOutput)}</div>
      {node.type !== "output" && node.type !== ("group" as CanvasNodeKind) ? (
        <button className="reference-node-port" type="button" title="拖出连线" onPointerDown={onLinkStart} />
      ) : null}
      <button className="reference-node-resize" type="button" title="调整节点大小" onPointerDown={onResizeStart} />
    </article>
  );
}

function renderNodeBody(
  node: CanvasNode,
  upstreamNodes: CanvasNode[],
  onData: (nodeId: string, patch: Record<string, unknown>) => void,
  onFiles: (files: File[]) => void,
  onRunNode: () => void,
  onImageFromAsset: (asset: { assetId: string; url: string }) => void,
  hasConnectedOutput: boolean
) {
  if (node.type === "image") {
    const url = stringValue(node.data.url);
    return (
      <label
        className={`reference-image-drop ${url ? "has-image" : ""}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {url ? <img src={url} alt={stringValue(node.data.name) || "image"} /> : <span>点击或拖入图片</span>}
        {url ? <em>{stringValue(node.data.name) || "已导入图片"}</em> : null}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="导入图片"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      </label>
    );
  }

  if (node.type === "prompt") {
    const value = stringValue(node.data.text);
    return (
      <label className="reference-prompt-field">
        <textarea
          aria-label="提示词内容"
          value={value}
          placeholder="输入提示词"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onData(node.id, { text: event.target.value })}
        />
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

  if (isApiImageNode(node.type)) {
    return <ReferenceGeneratorBody node={node} upstreamNodes={upstreamNodes} onData={onData} onRunNode={onRunNode} hasConnectedOutput={hasConnectedOutput} />;
  }

  if (node.type === "output") {
    const outputs = Array.isArray(node.data.outputs) ? node.data.outputs.filter(isOutputAsset) : [];
    return outputs.length ? (
      <div className="reference-output-grid">
        {outputs.map((asset) => (
          <figure className={stringValue(node.data.selectedOutputAssetId) === asset.assetId ? "is-selected" : ""} key={asset.assetId}>
            <button type="button" onClick={() => onData(node.id, { selectedOutputAssetId: asset.assetId })} title="选择结果">
              <img src={asset.url} alt={asset.assetId} />
            </button>
            <figcaption>{asset.assetId}</figcaption>
            <button type="button" className="reference-output-action" onClick={() => onImageFromAsset(asset)}>
              回填
            </button>
          </figure>
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

function ReferenceGeneratorBody({
  node,
  hasConnectedOutput,
  upstreamNodes,
  onData,
  onRunNode
}: {
  node: CanvasNode;
  hasConnectedOutput: boolean;
  upstreamNodes: CanvasNode[];
  onData: (nodeId: string, patch: Record<string, unknown>) => void;
  onRunNode: () => void;
}) {
  const inputSummary = generatorNodeInputSummary(node, upstreamNodes);
  const prompt = inputSummary.prompt;
  const providerId = stringValue(node.data.providerId);
  const model = stringValue(node.data.model) || "gpt-image-2";
  const resolution = stringValue(node.data.resolution) || "1k";
  const ratio = stringValue(node.data.ratio) || "square";
  const count = clamp(Number(node.data.count) || 1, 1, 8);
  const customWidth = stringValue(node.data.customWidth);
  const customHeight = stringValue(node.data.customHeight);
  const params = recordValue(node.data.params);
  const seed = stringValue(params.seed);
  const showCustomSize = resolution === "custom" || ratio === "custom";

  const setCount = (next: number) => onData(node.id, { count: clamp(next, 1, 8) });
  const setParam = (key: string, value: string | number) => onData(node.id, { params: { ...params, [key]: value } });

  return (
    <div className="reference-generator-body">
      <div className="reference-prompt-list">
        {prompt ? (
          <>
            <span>Prompt · {inputSummary.promptSource === node.id ? "本节点" : "连线"}</span>
            <p>{prompt}</p>
          </>
        ) : (
          <span>连接提示词，或在下方覆盖提示词</span>
        )}
      </div>
      <div className="reference-generator-label">Images</div>
      <div className="reference-input-list">
        {inputSummary.images.length ? (
          inputSummary.images.map((image) => (
            <figure key={`${image.sourceNodeId}-${image.assetId}`}>
              <img src={image.url} alt={image.name} />
              <figcaption>{image.name}</figcaption>
            </figure>
          ))
        ) : (
          <span>连接图片、Output 或分组后显示输入素材</span>
        )}
      </div>
      <div className="reference-gen-settings">
        <div className="reference-gen-row">
          <select value={providerId} onChange={(event) => onData(node.id, { providerId: event.target.value })}>
            <option value="">默认 API</option>
            <option value="openai">OpenAI</option>
            <option value="apimart">APIMart</option>
          </select>
          <input value={model} onChange={(event) => onData(node.id, { model: event.target.value })} />
        </div>
        <div className="reference-gen-row">
          <select value={resolution} onChange={(event) => onData(node.id, { resolution: event.target.value })}>
            <option value="1k">1K</option>
            <option value="2k">2K</option>
            <option value="4k">4K</option>
            <option value="custom">自定义</option>
          </select>
          <select value={ratio} onChange={(event) => onData(node.id, { ratio: event.target.value })}>
            <option value="square">1:1</option>
            <option value="portrait">2:3</option>
            <option value="landscape">3:2</option>
            <option value="portrait43">3:4</option>
            <option value="landscape43">4:3</option>
            <option value="story">9:16</option>
            <option value="wide">16:9</option>
            <option value="custom">自定义</option>
          </select>
          <div className="reference-gen-stepper">
            <button type="button" onClick={() => setCount(count - 1)} aria-label="减少数量">
              ‹
            </button>
            <input value={count} inputMode="numeric" onChange={(event) => setCount(Number(event.target.value) || 1)} />
            <button type="button" onClick={() => setCount(count + 1)} aria-label="增加数量">
              ›
            </button>
          </div>
        </div>
        <div className="reference-gen-row">
          <label>
            <span>Seed</span>
            <input value={seed} placeholder="随机" onChange={(event) => setParam("seed", event.target.value)} />
          </label>
          <label>
            <span>Batch</span>
            <input value={count} inputMode="numeric" onChange={(event) => setCount(Number(event.target.value) || 1)} />
          </label>
        </div>
        {showCustomSize ? (
          <div className="reference-gen-row">
            <label>
              <span>Width</span>
              <input
                type="number"
                min="64"
                step="64"
                value={customWidth}
                placeholder="Auto"
                onChange={(event) => onData(node.id, { customWidth: event.target.value })}
              />
            </label>
            <label>
              <span>Height</span>
              <input
                type="number"
                min="64"
                step="64"
                value={customHeight}
                placeholder="Auto"
                onChange={(event) => onData(node.id, { customHeight: event.target.value })}
              />
            </label>
          </div>
        ) : null}
      </div>
      <div className="reference-gen-run-row">
        {!hasConnectedOutput ? <span className="reference-gen-warning">建议先连接 Output 节点</span> : null}
        <button type="button" className="reference-gen-btn" onClick={onRunNode}>
          {node.type === "api_text2img" ? "API生成" : node.type === "api_img2img" ? "图生图" : "局部重绘"}
        </button>
      </div>
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

function SelectionBox({ selection }: { selection: Extract<DragState, { type: "select" }> }) {
  const left = Math.min(selection.startX, selection.currentX);
  const top = Math.min(selection.startY, selection.currentY);
  const width = Math.abs(selection.currentX - selection.startX);
  const height = Math.abs(selection.currentY - selection.startY);
  return <div className="reference-selection-box" style={{ left, top, width, height }} aria-hidden="true" />;
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
      width: 380,
      height: 360,
      data: { ...providerData, model: "gpt-image-2", resolution: "1k", ratio: "square", count: 1, params: { strength: 0.55 } },
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

export function nodeDefinition(type: CanvasNodeKind, providerId?: string): NodeDefinition {
  const providerData = providerId ? { providerId } : {};
  switch (type) {
    case "image":
      return { type, title: "图片", data: {}, width: 280, height: 240 };
    case "prompt":
      return { type, title: "提示词", data: { text: "" }, width: 320, height: 210 };
    case "loop":
      return { type, title: "循环", data: { count: 4, prompt: "" }, width: 300, height: 200 };
    case "api_img2img":
      return { type, title: "图生图", data: { ...providerData, model: "gpt-image-2", resolution: "1k", ratio: "square", count: 1 }, width: 380, height: 360 };
    case "api_inpaint":
      return { type, title: "局部重绘", data: { ...providerData, model: "gpt-image-2", resolution: "1k", ratio: "square", count: 1 }, width: 380, height: 360 };
    case "video":
      return { type, title: "视频生成", data: { ...providerData, model: "" }, width: 330, height: 220 };
    case "comfy":
      return { type, title: "ComfyUI", data: { workflow: "" }, width: 340, height: 230 };
    case "output":
      return { type, title: "Output", data: {}, width: 360, height: 250 };
    case "api_text2img":
    default:
      return { type: "api_text2img", title: "API生成", data: { ...providerData, model: "gpt-image-2", resolution: "1k", ratio: "square", count: 1 }, width: 380, height: 360 };
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

export function edgeActionPosition(
  from: Pick<CanvasNode, "x" | "y" | "width" | "height">,
  to: Pick<CanvasNode, "x" | "y" | "width" | "height">,
  viewport: Viewport
): { x: number; y: number } {
  const start = nodePortPoint(from);
  const end = { x: to.x, y: to.y + to.height / 2 };
  return {
    x: viewport.x + ((start.x + end.x) / 2) * viewport.zoom,
    y: viewport.y + ((start.y + end.y) / 2) * viewport.zoom
  };
}

function nodePortPoint(node: Pick<CanvasNode, "x" | "y" | "width" | "height">): { x: number; y: number } {
  return { x: node.x + node.width, y: node.y + node.height / 2 };
}

function normalizedRect(x1: number, y1: number, x2: number, y2: number): { left: number; top: number; right: number; bottom: number } {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2)
  };
}

function rectIntersectsNode(
  rect: { left: number; top: number; right: number; bottom: number },
  node: CanvasNode
): boolean {
  const nodeRect = {
    left: node.x,
    top: node.y,
    right: node.x + node.width,
    bottom: node.y + node.height
  };
  return rect.left <= nodeRect.right && rect.right >= nodeRect.left && rect.top <= nodeRect.bottom && rect.bottom >= nodeRect.top;
}

export function collectDragNodeIds(nodes: CanvasNode[], selectedIds: string[], activeId: string): string[] {
  const baseIds = selectedIds.includes(activeId) ? selectedIds : [activeId];
  const result = new Set<string>();

  for (const id of baseIds) {
    result.add(id);
    const node = nodes.find((item) => item.id === id);
    if (node?.type === "group" && Array.isArray(node.data.childIds)) {
      for (const childId of node.data.childIds) {
        if (typeof childId === "string") {
          result.add(childId);
        }
      }
    }
  }

  return Array.from(result);
}

export function moveCanvasNodes(nodes: CanvasNode[], dragIds: string[], dx: number, dy: number): CanvasNode[] {
  const moving = new Set(dragIds);
  return nodes.map((node) => (moving.has(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node));
}

export function deleteCanvasSelection(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  selectedIds: string[],
  selectedEdgeId: string | null
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  if (selectedIds.length === 0 && selectedEdgeId) {
    return {
      nodes,
      edges: edges.filter((edge) => edge.id !== selectedEdgeId)
    };
  }

  const selected = new Set(selectedIds);
  return {
    nodes: nodes.filter((node) => !selected.has(node.id)),
    edges: edges.filter((edge) => !selected.has(edge.from) && !selected.has(edge.to))
  };
}

export function promptGeneSourceFromNodes(
  nodes: readonly Pick<CanvasNode, "id" | "type" | "data">[],
  selectedIds: readonly string[]
): { prompt: string; sourceNodeId: string } | undefined {
  const selected = nodes.find((node) => selectedIds.includes(node.id) && node.type === "prompt");
  const selectedPrompt = selected ? stringValue(selected.data.text).trim() : "";
  if (selected && selectedPrompt) {
    return { prompt: selectedPrompt, sourceNodeId: selected.id };
  }

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    const prompt = node.type === "prompt" ? stringValue(node.data.text).trim() : "";
    if (prompt) {
      return { prompt, sourceNodeId: node.id };
    }
  }

  return undefined;
}

export function upstreamNodesFor(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[], nodeId: string): CanvasNode[] {
  const upstreamIds = edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
  return upstreamIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is CanvasNode => Boolean(node));
}

export function generatorNodeInputSummary(
  node: CanvasNode,
  upstreamNodes: readonly CanvasNode[]
): {
  prompt: string;
  promptSource?: string | undefined;
  images: Array<{ assetId: string; url: string; name: string; sourceNodeId: string }>;
} {
  const promptNode = upstreamNodes.find((upstream) => ["prompt", "loop", "llm"].includes(upstream.type));
  const upstreamPrompt = promptNode ? (stringValue(promptNode.data.text) || stringValue(promptNode.data.prompt)).trim() : "";
  const directPrompt = stringValue(node.data.prompt).trim();

  return {
    prompt: upstreamPrompt || directPrompt,
    promptSource: upstreamPrompt ? promptNode?.id : directPrompt ? node.id : undefined,
    images: upstreamNodes.flatMap((upstream) => imageInputsFromNode(upstream))
  };
}

export function mergeOutputAssets(
  existing: readonly { assetId: string; url: string }[],
  incoming: readonly { assetId: string; url: string }[]
): Array<{ assetId: string; url: string }> {
  const seen = new Set(existing.map((asset) => asset.assetId));
  const next = [...existing];
  incoming.forEach((asset) => {
    if (!seen.has(asset.assetId)) {
      next.push(asset);
      seen.add(asset.assetId);
    }
  });
  return next;
}

export function outputNodeForAssets(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  sourceNodeId?: string
): CanvasNode | undefined {
  if (sourceNodeId) {
    const outputEdge = edges.find((edge) => edge.from === sourceNodeId && nodes.find((node) => node.id === edge.to)?.type === "output");
    const connectedOutput = outputEdge ? nodes.find((node) => node.id === outputEdge.to && node.type === "output") : undefined;
    if (connectedOutput) {
      return connectedOutput;
    }
  }

  return nodes.find((node) => node.type === "output");
}

export function hasConnectedOutput(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[], sourceNodeId: string): boolean {
  return edges.some((edge) => edge.from === sourceNodeId && nodes.find((node) => node.id === edge.to)?.type === "output");
}

export function selectedOutputAssetFromNode(node: Pick<CanvasNode, "type" | "data"> | undefined): { assetId: string; url: string } | undefined {
  if (node?.type !== "output") {
    return undefined;
  }
  const outputs = Array.isArray(node.data.outputs) ? node.data.outputs.filter(isOutputAsset) : [];
  const selectedId = stringValue(node.data.selectedOutputAssetId);
  const selected = selectedId ? outputs.find((asset) => asset.assetId === selectedId) : undefined;
  return selected ?? outputs[outputs.length - 1];
}

function imageInputsFromNode(node: CanvasNode): Array<{ assetId: string; url: string; name: string; sourceNodeId: string }> {
  if (node.type === "image" && stringValue(node.data.assetId) && stringValue(node.data.url)) {
    return [
      {
        assetId: stringValue(node.data.assetId),
        url: stringValue(node.data.url),
        name: stringValue(node.data.name) || stringValue(node.data.assetId),
        sourceNodeId: node.id
      }
    ];
  }

  if (node.type === "output" && Array.isArray(node.data.outputs)) {
    return node.data.outputs.filter(isOutputAsset).map((asset) => ({
      assetId: asset.assetId,
      url: asset.url,
      name: asset.assetId,
      sourceNodeId: node.id
    }));
  }

  return [];
}

export function workflowGeneSourceFromSelection(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  selectedIds: readonly string[],
  scope: WorkflowGeneScope = "selection"
): { snapshot: CanvasSnapshot; nodeCount: number } | undefined {
  const selected = workflowGeneNodeIds(nodes, edges, selectedIds, scope);
  const pickedNodes = nodes.filter((node) => selected.has(node.id)).map((node) => ({ ...node, data: { ...node.data }, status: "idle" as CanvasNodeStatus }));
  if (pickedNodes.length < 2) {
    return undefined;
  }

  const pickedEdges = edges
    .filter((edge) => selected.has(edge.from) && selected.has(edge.to))
    .map((edge) => ({ ...edge }));

  return {
    nodeCount: pickedNodes.length,
    snapshot: {
      canvasId: "gene-workflow",
      nodes: pickedNodes,
      edges: pickedEdges,
      viewport: { x: 0, y: 0, zoom: 1 },
      updatedAt: new Date().toISOString()
    }
  };
}

function workflowGeneNodeIds(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  selectedIds: readonly string[],
  scope: WorkflowGeneScope
): Set<string> {
  if (scope === "canvas") {
    return new Set(nodes.map((node) => node.id));
  }

  if (selectedIds.length < 2) {
    return new Set();
  }

  const selected = new Set(selectedIds);
  if (scope !== "selectionWithOutputs") {
    return selected;
  }

  edges.forEach((edge) => {
    if (!selected.has(edge.from)) {
      return;
    }
    const target = nodes.find((node) => node.id === edge.to);
    if (target?.type === "output") {
      selected.add(target.id);
    }
  });

  return selected;
}

export function importWorkflowGeneToCanvas(
  currentNodes: readonly CanvasNode[],
  currentEdges: readonly CanvasEdge[],
  snapshot: CanvasSnapshot,
  idPrefix: string,
  options: number | { targetCenter?: { x: number; y: number }; avoidOverlap?: boolean; offset?: number } = 80
): { nodes: CanvasNode[]; edges: CanvasEdge[]; importedIds: string[] } {
  const idMap = new Map<string, string>();
  const placement = workflowPlacementOffset(snapshot.nodes, currentNodes, options);
  const importedNodes = snapshot.nodes.map((node, index) => {
    const id = `${idPrefix}_node_${index}`;
    idMap.set(node.id, id);
    return {
      ...node,
      id,
      x: node.x + placement.x,
      y: node.y + placement.y,
      data: { ...node.data },
      status: "idle" as CanvasNodeStatus
    };
  });

  const importedEdges = snapshot.edges.flatMap((edge, index) => {
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to) {
      return [];
    }
    return [{ ...edge, id: `${idPrefix}_edge_${index}`, from, to }];
  });

  return {
    nodes: [...currentNodes, ...importedNodes],
    edges: [...currentEdges, ...importedEdges],
    importedIds: importedNodes.map((node) => node.id)
  };
}

function workflowPlacementOffset(
  sourceNodes: readonly CanvasNode[],
  currentNodes: readonly CanvasNode[],
  options: number | { targetCenter?: { x: number; y: number }; avoidOverlap?: boolean; offset?: number }
): { x: number; y: number } {
  if (typeof options === "number") {
    return { x: options, y: options };
  }

  const bounds = nodeBounds(sourceNodes);
  const fallbackOffset = options.offset ?? 80;
  let placement = options.targetCenter
    ? {
        x: options.targetCenter.x - (bounds.left + bounds.width / 2),
        y: options.targetCenter.y - (bounds.top + bounds.height / 2)
      }
    : { x: fallbackOffset, y: fallbackOffset };

  if (!options.avoidOverlap) {
    return placement;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = sourceNodes.map((node) => ({ ...node, x: node.x + placement.x, y: node.y + placement.y }));
    if (!candidate.some((node) => currentNodes.some((existing) => nodesOverlap(node, existing)))) {
      return placement;
    }
    placement = { x: placement.x + 48, y: placement.y + 48 };
  }

  return placement;
}

function nodeBounds(nodes: readonly CanvasNode[]): { left: number; top: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { left, top, width: right - left, height: bottom - top };
}

function nodesOverlap(a: Pick<CanvasNode, "x" | "y" | "width" | "height">, b: Pick<CanvasNode, "x" | "y" | "width" | "height">): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function linkOptions(type: CanvasNodeKind): Array<{ type: CanvasNodeKind; label: string; icon: LucideIcon }> {
  if (["api_text2img", "api_img2img", "api_inpaint", "video", "comfy"].includes(type)) {
    return [{ type: "output", label: "Output", icon: CircleDot }];
  }
  return [
    { type: "prompt", label: "提示词", icon: FileText },
    { type: "loop", label: "循环", icon: Repeat2 },
    { type: "api_text2img", label: "API生成", icon: WandSparkles },
    { type: "api_img2img", label: "图生图", icon: ImagePlus },
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
    api_img2img: ImagePlus,
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
    api_img2img: "图生图",
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isApiImageNode(type: CanvasNodeKind): boolean {
  return type === "api_text2img" || type === "api_img2img" || type === "api_inpaint";
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
