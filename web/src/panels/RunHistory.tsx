import type { CanvasSession } from "../api/client";

export function RunHistory({ session }: { session: CanvasSession | null }) {
  const latestRun = session?.runs?.at(-1);
  const latestVersions = session?.versions.slice(-4).reverse() ?? [];

  return (
    <section className="history-panel">
      <h2 className="panel-heading">运行历史</h2>
      {!session ? (
        <p className="muted compact">运行一次画布后，这里会显示来源链。</p>
      ) : (
        <div className="history-block">
          <div className="history-kv">
            <span>Session</span>
            <strong>{session.sessionId}</strong>
          </div>
          <div className="history-kv">
            <span>当前版本</span>
            <strong>{session.currentVersionId ?? "-"}</strong>
          </div>
          {latestRun ? (
            <article className={`history-run ${latestRun.status}`}>
              <div className="history-run-head">
                <strong>{latestRun.runId}</strong>
                <span>{latestRun.latencyMs}ms</span>
              </div>
              <div className="history-node-list">
                {latestRun.nodes.map((node) => (
                  <div className={`history-node ${node.status}`} key={`${latestRun.runId}-${node.nodeId}`}>
                    <div>
                      <strong>{node.nodeId}</strong>
                      <span>{node.nodeType}</span>
                    </div>
                    <small>{node.versionId ?? node.status}</small>
                    {node.prompt ? <p>{node.prompt}</p> : null}
                    <small>
                      输入 {node.inputAssetIds.length} / 输出 {node.outputAssetIds.length}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
          {latestVersions.length > 0 ? (
            <div className="version-list">
              <h3>版本链</h3>
              {latestVersions.map((version) => (
                <div className="version-item" key={version.versionId}>
                  <strong>{version.versionId}</strong>
                  <span>{version.action}</span>
                  <small>{version.sourceNodeId ?? "-"} · {version.providerId ?? "local"}</small>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
