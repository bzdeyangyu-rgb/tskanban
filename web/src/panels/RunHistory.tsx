import { useEffect, useMemo, useState } from "react";
import { fetchAssetProvenance, type AssetProvenance, type CanvasSession } from "../api/client";

export function RunHistory({ session }: { session: CanvasSession | null }) {
  const latestRun = session?.runs?.at(-1);
  const latestVersions = session?.versions.slice(-6).reverse() ?? [];
  const outputAssetIds = useMemo(
    () => Array.from(new Set(latestVersions.flatMap((version) => version.outputAssetIds))),
    [latestVersions]
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [trace, setTrace] = useState<AssetProvenance | null>(null);
  const [traceStatus, setTraceStatus] = useState("");

  useEffect(() => {
    setSelectedAssetId(outputAssetIds[0] ?? "");
  }, [outputAssetIds]);

  useEffect(() => {
    if (!session || !selectedAssetId) {
      setTrace(null);
      return;
    }

    let cancelled = false;
    setTraceStatus("读取来源链");
    fetchAssetProvenance(session.sessionId, selectedAssetId)
      .then((result) => {
        if (!cancelled) {
          setTrace(result);
          setTraceStatus("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTrace(null);
          setTraceStatus(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAssetId, session]);

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
                <button
                  className="version-item"
                  key={version.versionId}
                  onClick={() => setSelectedAssetId(version.outputAssetIds[0] ?? "")}
                  type="button"
                >
                  <strong>{version.versionId}</strong>
                  <span>{version.action}</span>
                  <small>
                    {version.sourceNodeId ?? "-"} · {version.providerId ?? "local"}
                  </small>
                </button>
              ))}
            </div>
          ) : null}
          {trace || traceStatus ? (
            <div className="trace-panel">
              <div className="history-run-head">
                <strong>来源链</strong>
                <span>{selectedAssetId || "-"}</span>
              </div>
              {traceStatus ? <p className="muted compact">{traceStatus}</p> : null}
              {trace?.chain.map((step, index) => (
                <div className="trace-step" key={`${step.assetId}-${step.versionId ?? index}`}>
                  <div>
                    <strong>{step.assetId}</strong>
                    <span>{step.versionId ?? "外部输入"}</span>
                  </div>
                  {step.prompt ? <p>{step.prompt}</p> : null}
                  <small>
                    {step.action ?? "asset"} · {step.model ?? "-"} · {step.sourceNodeId ?? "-"}
                  </small>
                  {step.parentAssetIds.length > 0 ? <small>父级 {step.parentAssetIds.join(", ")}</small> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
