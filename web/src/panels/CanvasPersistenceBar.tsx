export function CanvasPersistenceBar({
  canvasId,
  savedAt,
  onLoad,
  onSave
}: {
  canvasId: string;
  savedAt: string;
  onLoad: () => void;
  onSave: () => void;
}) {
  return (
    <section className="persistence-panel">
      <h2 className="panel-heading">画布</h2>
      <div className="history-kv">
        <span>ID</span>
        <strong>{canvasId}</strong>
      </div>
      <div className="persistence-actions">
        <button className="mini-button dark" onClick={onSave} type="button">
          保存画布
        </button>
        <button className="mini-button" onClick={onLoad} type="button">
          读取画布
        </button>
      </div>
      {savedAt ? <p className="muted compact">最近保存：{savedAt}</p> : <p className="muted compact">尚未保存</p>}
    </section>
  );
}
