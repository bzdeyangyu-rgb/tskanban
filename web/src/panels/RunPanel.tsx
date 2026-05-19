export function RunPanel({ onRun, status, nodeCount }: { onRun: () => void; status: string; nodeCount: number }) {
  return (
    <footer className="run-panel">
      <button type="button" className="primary-button" onClick={onRun}>
        运行流程
      </button>
      <span className="muted">{status}</span>
      {nodeCount > 0 ? <span className="run-count">{nodeCount}</span> : null}
    </footer>
  );
}
