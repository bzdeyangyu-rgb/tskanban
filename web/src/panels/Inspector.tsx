export function Inspector() {
  return (
    <section className="panel-stack">
      <h2 className="panel-heading">属性</h2>
      <p className="muted">选择节点后，这里会显示参数、输入输出和运行状态。</p>
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
    </section>
  );
}
