import type { ChangeEvent } from "react";
import type { FlowExecutionNode } from "../api/client";
import type { TshuabuNodeMeta } from "../canvas/shapeUtils";

type SelectedNode = {
  id: string;
  meta: TshuabuNodeMeta;
};

type InspectorProps = {
  runNodes: FlowExecutionNode[];
  selectedNode: SelectedNode | null;
  onUpdateSelectedNode: (patch: Record<string, unknown>) => void;
};

export function Inspector({ runNodes, selectedNode, onUpdateSelectedNode }: InspectorProps) {
  return (
    <section className="panel-stack">
      <h2 className="panel-heading">属性</h2>
      {selectedNode ? (
        <NodeEditor selectedNode={selectedNode} onUpdateSelectedNode={onUpdateSelectedNode} />
      ) : (
        <p className="muted">选中一个节点后，可以在这里编辑运行参数。</p>
      )}

      {runNodes.length > 0 ? (
        <div className="run-results">
          {runNodes.map((node) => (
            <div className={`run-result ${node.status}`} key={node.nodeId}>
              <span>{node.nodeId}</span>
              <strong>{node.status}</strong>
              {node.outputAssets?.map((asset) => (
                <a href={asset.url} target="_blank" rel="noreferrer" key={asset.assetId}>
                  {asset.assetId}
                </a>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NodeEditor({
  selectedNode,
  onUpdateSelectedNode
}: {
  selectedNode: SelectedNode;
  onUpdateSelectedNode: (patch: Record<string, unknown>) => void;
}) {
  const { meta } = selectedNode;
  const updateString = (key: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onUpdateSelectedNode({ [key]: event.target.value });
  };

  return (
    <div className="field-list">
      <label className="field">
        节点类型
        <span className="field-value">{meta.nodeType}</span>
      </label>

      {meta.nodeType === "prompt" ? (
        <label className="field">
          Prompt
          <textarea
            className="field-control field-textarea"
            value={stringValue(meta.data.text)}
            onChange={updateString("text")}
          />
        </label>
      ) : null}

      {meta.nodeType === "image" ? (
        <label className="field">
          Asset ID
          <input className="field-control" value={stringValue(meta.data.assetId)} onChange={updateString("assetId")} />
        </label>
      ) : null}

      {meta.nodeType.startsWith("api_") ? (
        <>
          <label className="field">
            Model
            <input className="field-control" value={stringValue(meta.data.model)} onChange={updateString("model")} />
          </label>
          <label className="field">
            Prompt 覆盖
            <textarea
              className="field-control field-textarea"
              value={stringValue(meta.data.prompt)}
              onChange={updateString("prompt")}
            />
          </label>
          <label className="field">
            Negative Prompt
            <textarea
              className="field-control field-textarea"
              value={stringValue(meta.data.negativePrompt)}
              onChange={updateString("negativePrompt")}
            />
          </label>
        </>
      ) : null}

      {meta.nodeType === "api_img2img" || meta.nodeType === "api_inpaint" ? (
        <label className="field">
          Base Asset ID
          <input
            className="field-control"
            value={stringValue(meta.data.baseAssetId)}
            onChange={updateString("baseAssetId")}
          />
        </label>
      ) : null}

      {meta.nodeType === "api_inpaint" ? (
        <label className="field">
          Mask Asset ID
          <input
            className="field-control"
            value={stringValue(meta.data.maskAssetId)}
            onChange={updateString("maskAssetId")}
          />
        </label>
      ) : null}
    </div>
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
