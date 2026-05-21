import { BaseBoxShapeUtil, HTMLContainer, type TLBaseShape } from "tldraw";
import type { DragEvent, PointerEvent } from "react";
import type { CanvasNodeKind, CanvasNodeStatus } from "./flowTypes";
import type { TshuabuNodeMeta } from "./shapeUtils";

export type TshuabuNodeShape = TLBaseShape<"tshuabu-node", { w: number; h: number }>;

export class TshuabuNodeShapeUtil extends BaseBoxShapeUtil<TshuabuNodeShape> {
  static override type = "tshuabu-node" as const;

  override canResize() {
    return true;
  }

  override isAspectRatioLocked() {
    return false;
  }

  override getDefaultProps(): TshuabuNodeShape["props"] {
    return { w: 280, h: 180 };
  }

  override component(shape: TshuabuNodeShape) {
    const meta = shape.meta;
    if (!isNodeMeta(meta)) {
      return <HTMLContainer className="tshuabu-node-card idle" />;
    }

    const status = meta.status ?? "idle";
    return (
      <HTMLContainer className={`tshuabu-node-card ${meta.nodeType} ${status}`}>
        <div className="tshuabu-node-head">
          <span>{meta.title}</span>
          <strong>{statusLabel(status)}</strong>
        </div>
        <NodeBody data={meta.data} nodeId={String(shape.id)} nodeType={meta.nodeType} status={status} />
        <span className="tshuabu-node-resize-cue" aria-hidden="true" />
        <button
          className="tshuabu-node-port out"
          type="button"
          aria-label="拖出新节点"
          title="拖出新节点"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            window.dispatchEvent(
              new CustomEvent("tshuabu:link-drag-start", {
                detail: {
                  shapeId: shape.id,
                  nodeType: meta.nodeType,
                  clientX: event.clientX,
                  clientY: event.clientY
                }
              })
            );
          }}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: TshuabuNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={22} ry={22} />;
  }
}

function NodeBody({
  data,
  nodeId,
  nodeType,
  status
}: {
  data: Record<string, unknown>;
  nodeId: string;
  nodeType: CanvasNodeKind;
  status?: CanvasNodeStatus;
}) {
  if (nodeType === "image") {
    const url = stringValue(data.url);
    return (
      <label
        className={`tshuabu-node-body image-dropzone ${url ? "has-image" : ""}`}
        onDrop={(event) => handleImageDrop(event, nodeId)}
        onDragOver={(event) => event.preventDefault()}
        onPointerDown={stopNodeControl}
      >
        {url ? <img alt={stringValue(data.name) || "素材"} className="node-thumb" src={url} /> : <div className="node-empty">点击或拖入图片</div>}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => dispatchNodeFiles(nodeId, event.target.files)}
        />
      </label>
    );
  }

  if (nodeType === "prompt") {
    const text = stringValue(data.text);
    return (
      <div className="tshuabu-node-body node-editor-body" onPointerDown={stopNodeControl}>
        <textarea value={text} placeholder="输入提示词" onChange={(event) => dispatchNodeData(nodeId, { text: event.target.value })} />
        <div className="node-char-count">{text.length} 字</div>
      </div>
    );
  }

  if (nodeType === "output") {
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    return (
      <div className="tshuabu-node-body output-preview-grid">
        {outputs.map((item) => {
          const output = outputAsset(item);
          return output ? <img alt="输出" key={output.assetId} src={output.url} /> : null;
        })}
        {outputs.length === 0 ? <div className="node-empty">等待输出</div> : null}
      </div>
    );
  }

  if (nodeType === "loop") {
    return (
      <div className="tshuabu-node-body node-editor-body loop-editor" onPointerDown={stopNodeControl}>
        <label>
          循环次数
          <input
            type="number"
            min="1"
            max="32"
            value={stringValue(data.count) || "4"}
            onChange={(event) => dispatchNodeData(nodeId, { count: event.target.value })}
          />
        </label>
        <textarea
          value={stringValue(data.prompt)}
          placeholder="每次循环追加的提示词"
          onChange={(event) => dispatchNodeData(nodeId, { prompt: event.target.value })}
        />
      </div>
    );
  }

  if (nodeType === "comfy") {
    return (
      <div className="tshuabu-node-body node-editor-body api-node-form" onPointerDown={stopNodeControl}>
        <NodeInput nodeId={nodeId} data={data} field="workflow" label="Workflow" placeholder="选择或填写 workflow" />
        <textarea
          value={stringValue(data.note)}
          placeholder="ComfyUI 参数说明"
          onChange={(event) => dispatchNodeData(nodeId, { note: event.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="tshuabu-node-body node-editor-body api-node-form" onPointerDown={stopNodeControl}>
      <NodeInput nodeId={nodeId} data={data} field="model" label={nodeType === "video" ? "视频模型" : "模型"} placeholder="选择模型" />
      <textarea
        value={stringValue(data.prompt)}
        placeholder={status === "failed" ? stringValue(data.errorMessage) || "执行失败" : "Prompt 覆盖，可连接提示词节点"}
        onChange={(event) => dispatchNodeData(nodeId, { prompt: event.target.value })}
      />
      {nodeType === "api_img2img" || nodeType === "api_inpaint" || nodeType === "video" ? (
        <NodeInput nodeId={nodeId} data={data} field="baseAssetId" label="Base Asset" placeholder="连接图片或填写 asset id" />
      ) : null}
      {nodeType === "api_inpaint" ? <NodeInput nodeId={nodeId} data={data} field="maskAssetId" label="Mask Asset" placeholder="mask asset id" /> : null}
    </div>
  );
}

function NodeInput({
  data,
  field,
  label,
  nodeId,
  placeholder
}: {
  data: Record<string, unknown>;
  field: string;
  label: string;
  nodeId: string;
  placeholder: string;
}) {
  return (
    <label>
      {label}
      <input
        value={stringValue(data[field])}
        placeholder={placeholder}
        onChange={(event) => dispatchNodeData(nodeId, { [field]: event.target.value })}
      />
    </label>
  );
}

function stopNodeControl(event: PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

function handleImageDrop(event: DragEvent<HTMLElement>, nodeId: string) {
  event.preventDefault();
  event.stopPropagation();
  dispatchNodeFiles(nodeId, event.dataTransfer.files);
}

function dispatchNodeFiles(nodeId: string, files: FileList | null) {
  const imageFiles = files ? Array.from(files).filter((file) => file.type.startsWith("image/")) : [];
  if (imageFiles.length === 0) {
    return;
  }
  window.dispatchEvent(new CustomEvent("tshuabu:image-node-files", { detail: { nodeId, files: imageFiles } }));
}

function dispatchNodeData(nodeId: string, patch: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("tshuabu:node-data-change", { detail: { nodeId, patch } }));
}

function isNodeMeta(meta: unknown): meta is TshuabuNodeMeta {
  return Boolean(
    meta &&
      typeof meta === "object" &&
      (meta as Partial<TshuabuNodeMeta>).kind === "tshuabu-node" &&
      typeof (meta as Partial<TshuabuNodeMeta>).nodeType === "string"
  );
}

function outputAsset(value: unknown): { assetId: string; url: string } | undefined {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { assetId?: unknown }).assetId === "string" &&
    typeof (value as { url?: unknown }).url === "string"
  ) {
    return value as { assetId: string; url: string };
  }
  return undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function statusLabel(status: CanvasNodeStatus): string {
  switch (status) {
    case "queued":
      return "排队";
    case "running":
      return "运行中";
    case "retrying":
      return "重试";
    case "success":
      return "成功";
    case "failed":
      return "失败";
    default:
      return "待机";
  }
}
