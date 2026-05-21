import { BaseBoxShapeUtil, HTMLContainer, type TLBaseShape } from "tldraw";
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
        <NodeBody data={meta.data} nodeType={meta.nodeType} status={status} />
      </HTMLContainer>
    );
  }

  override indicator(shape: TshuabuNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={22} ry={22} />;
  }
}

function NodeBody({
  data,
  nodeType,
  status
}: {
  data: Record<string, unknown>;
  nodeType: CanvasNodeKind;
  status?: CanvasNodeStatus;
}) {
  if (nodeType === "image") {
    const url = stringValue(data.url);
    return (
      <div className="tshuabu-node-body">
        {url ? <img alt={stringValue(data.name) || "素材"} className="node-thumb" src={url} /> : <div className="node-empty">拖入图片</div>}
      </div>
    );
  }

  if (nodeType === "prompt") {
    return <div className="tshuabu-node-body prompt-preview">{stringValue(data.text) || "输入提示词"}</div>;
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

  return (
    <div className="tshuabu-node-body api-preview">
      <span>{stringValue(data.model) || "选择模型"}</span>
      <small>
        {status === "failed" ? stringValue(data.errorMessage) || "执行失败" : stringValue(data.prompt) || "连接 Prompt 或填写覆盖提示词"}
      </small>
    </div>
  );
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
