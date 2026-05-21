export function CanvasPersistenceBar({
  canvasId,
  savedAt,
  onLoad,
  onExport,
  onSave
}: {
  canvasId: string;
  savedAt: string;
  onLoad: () => void;
  onExport: () => void;
  onSave: () => void;
}) {
  return (
    <section className="persistence-panel compact-card">
      <h2 className="panel-heading">画布</h2>
      <div className="history-kv">
        <span>ID</span>
        <strong>{canvasId}</strong>
      </div>
      <div className="persistence-actions">
        <button className="mini-button dark" onClick={onSave} type="button">
          保存
        </button>
        <button className="mini-button" onClick={onLoad} type="button">
          读取
        </button>
        <button className="mini-button" onClick={onExport} type="button">
          导出
        </button>
      </div>
      {savedAt ? <p className="muted compact">最近保存：{savedAt}</p> : <p className="muted compact">尚未保存</p>}
    </section>
  );
}
