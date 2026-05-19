import type { FlowExecutionNode } from "../api/client";

export function Inspector({ runNodes }: { runNodes: FlowExecutionNode[] }) {
  return (
    <section className="panel-stack">
      <h2 className="panel-heading">属性</h2>
      <p className="muted">选择节点后，可在 tldraw 中移动、缩放和用箭头连接。运行结果会显示在这里。</p>
      <div className="field-list">
        <label className="field">
          节点类型
          <span className="field-value">未选择</span>
        </label>
        <label className="field">
          参数
          <span className="field-value">等待画布输入</span>
        </label>
      </div>
      {runNodes.length > 0 ? (
        <div className="run-results">
          {runNodes.map((node) => (
            <div className={`run-result ${node.status}`} key={node.nodeId}>
              <span>{node.nodeId}</span>
              <strong>{node.status}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
