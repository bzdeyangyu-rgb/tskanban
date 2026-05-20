import type { ChangeEvent } from "react";
import type { ApiProvider, FlowExecutionNode } from "../api/client";
import type { TshuabuNodeMeta } from "../canvas/shapeUtils";

type SelectedNode = {
  id: string;
  meta: TshuabuNodeMeta;
};

type InspectorProps = {
  providers: ApiProvider[];
  runNodes: FlowExecutionNode[];
  selectedNode: SelectedNode | null;
  onUpdateSelectedNode: (patch: Record<string, unknown>) => void;
};

export function Inspector({ providers, runNodes, selectedNode, onUpdateSelectedNode }: InspectorProps) {
  return (
    <section className="panel-stack">
      <h2 className="panel-heading">属性</h2>
      {selectedNode ? (
        <NodeEditor providers={providers} selectedNode={selectedNode} onUpdateSelectedNode={onUpdateSelectedNode} />
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
  providers,
  selectedNode,
  onUpdateSelectedNode
}: {
  providers: ApiProvider[];
  selectedNode: SelectedNode;
  onUpdateSelectedNode: (patch: Record<string, unknown>) => void;
}) {
  const { meta } = selectedNode;
  const updateString = (key: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onUpdateSelectedNode({ [key]: event.target.value });
  };
  const isApiNode = meta.nodeType.startsWith("api_") || meta.nodeType === "video";
  const selectedProvider = providers.find((provider) => provider.id === stringValue(meta.data.providerId)) ?? providers[0];
  const models = modelsForNode(selectedProvider, meta.nodeType);

  return (
    <div className="field-list">
      <label className="field">
        节点类型
        <span className="field-value">{meta.nodeType}</span>
      </label>

      {meta.nodeType === "prompt" ? (
        <label className="field">
          Prompt
          <textarea className="field-control field-textarea" value={stringValue(meta.data.text)} onChange={updateString("text")} />
        </label>
      ) : null}

      {meta.nodeType === "image" ? (
        <label className="field">
          Asset ID
          <input className="field-control" value={stringValue(meta.data.assetId)} onChange={updateString("assetId")} />
        </label>
      ) : null}

      {isApiNode ? (
        <>
          <label className="field">
            Provider
            <select className="field-control" value={stringValue(meta.data.providerId)} onChange={updateString("providerId")}>
              <option value="">默认平台</option>
              {providers.map((provider) => (
                <option value={provider.id} key={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Model
            {models.length > 0 ? (
              <select className="field-control" value={stringValue(meta.data.model)} onChange={updateString("model")}>
                <option value="">选择模型</option>
                {models.map((model) => (
                  <option value={model} key={model}>
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <input className="field-control" value={stringValue(meta.data.model)} onChange={updateString("model")} />
            )}
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

      {meta.nodeType === "api_img2img" || meta.nodeType === "api_inpaint" || meta.nodeType === "video" ? (
        <label className="field">
          Base Asset ID
          <input className="field-control" value={stringValue(meta.data.baseAssetId)} onChange={updateString("baseAssetId")} />
        </label>
      ) : null}

      {meta.nodeType === "api_inpaint" ? (
        <label className="field">
          Mask Asset ID
          <input className="field-control" value={stringValue(meta.data.maskAssetId)} onChange={updateString("maskAssetId")} />
        </label>
      ) : null}
    </div>
  );
}

function modelsForNode(provider: ApiProvider | undefined, nodeType: string): string[] {
  if (!provider) {
    return [];
  }
  if (nodeType === "video") {
    return provider.videoModels;
  }
  if (nodeType.startsWith("api_")) {
    return provider.imageModels;
  }
  return [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
