import { useEffect, useMemo, useState } from "react";
import {
  fetchAssetProvenance,
  fetchRagEvents,
  type AssetProvenance,
  type CanvasRunRecord,
  type CanvasSession,
  type RagEvent
} from "../api/client";
import { buildRunHistoryModel, findRunById } from "./runHistoryModel";

type HistoryTab = "runs" | "versions" | "source" | "rag";

export function RunHistory({ session }: { session: CanvasSession | null }) {
  const model = useMemo(() => (session ? buildRunHistoryModel(session) : null), [session]);
  const [tab, setTab] = useState<HistoryTab>("runs");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [trace, setTrace] = useState<AssetProvenance | null>(null);
  const [traceStatus, setTraceStatus] = useState("");
  const [ragEvents, setRagEvents] = useState<RagEvent[]>([]);
  const [ragStatus, setRagStatus] = useState("");

  useEffect(() => {
    setSelectedRunId(model?.defaultRunId ?? "");
    setSelectedAssetId(model?.defaultAssetId ?? "");
  }, [model]);

  useEffect(() => {
    if (!session || !selectedAssetId) {
      setTrace(null);
      return;
    }

    let cancelled = false;
    setTraceStatus("读取来源链...");
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

  useEffect(() => {
    if (!session || !selectedAssetId) {
      setRagEvents([]);
      return;
    }

    let cancelled = false;
    setRagStatus("读取 RAG 日志...");
    fetchRagEvents({ sessionId: session.sessionId, assetId: selectedAssetId, limit: 8 })
      .then((events) => {
        if (!cancelled) {
          setRagEvents(events.reverse());
          setRagStatus("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRagEvents([]);
          setRagStatus(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAssetId, session]);

  if (!session || !model) {
    return (
      <section className="history-panel compact-card">
        <h2 className="panel-heading">运行历史</h2>
        <p className="muted compact">运行一次画布后，这里会显示结果、版本和来源链。</p>
      </section>
    );
  }

  const selectedRun = findRunById(model, selectedRunId);

  return (
    <section className="history-panel compact-card">
      <h2 className="panel-heading">运行历史</h2>
      <div className="history-block">
        <div className="history-kv">
          <span>Session</span>
          <strong>{session.sessionId}</strong>
        </div>
        <div className="history-kv">
          <span>当前版本</span>
          <strong>{session.currentVersionId ?? "-"}</strong>
        </div>
        <div className="history-tabs" role="tablist" aria-label="运行历史视图">
          {(["runs", "versions", "source", "rag"] as HistoryTab[]).map((item) => (
            <button
              aria-selected={tab === item}
              className={tab === item ? "active" : ""}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {tabLabel(item)}
            </button>
          ))}
        </div>
        {tab === "runs" ? (
          <RunList runs={model.runs} selectedRun={selectedRun} selectedRunId={selectedRunId} onSelect={setSelectedRunId} />
        ) : null}
        {tab === "versions" ? (
          <VersionList
            selectedAssetId={selectedAssetId}
            versions={model.versions}
            onSelectAsset={(assetId) => {
              setSelectedAssetId(assetId);
              setTab("source");
            }}
          />
        ) : null}
        {tab === "source" ? (
          <TracePanel selectedAssetId={selectedAssetId} trace={trace} traceStatus={traceStatus} />
        ) : null}
        {tab === "rag" ? (
          <RagPanel events={ragEvents} ragStatus={ragStatus} selectedAssetId={selectedAssetId} />
        ) : null}
      </div>
    </section>
  );
}

function RunList({
  runs,
  selectedRun,
  selectedRunId,
  onSelect
}: {
  runs: CanvasRunRecord[];
  selectedRun?: CanvasRunRecord;
  selectedRunId: string;
  onSelect: (runId: string) => void;
}) {
  return (
    <div className="history-run-grid">
      <div className="history-run-list">
        {runs.map((run) => (
          <button
            className={`history-run-row ${run.status} ${selectedRunId === run.runId ? "active" : ""}`}
            key={run.runId}
            onClick={() => onSelect(run.runId)}
            type="button"
          >
            <strong>{run.runId}</strong>
            <span>{run.status}</span>
            <small>{run.latencyMs}ms</small>
          </button>
        ))}
      </div>
      {selectedRun ? (
        <article className={`history-run ${selectedRun.status}`}>
          <div className="history-run-head">
            <strong>{selectedRun.runId}</strong>
            <span>{selectedRun.nodes.length} 节点</span>
          </div>
          <div className="history-node-list">
            {selectedRun.nodes.map((node) => (
              <div className={`history-node ${node.status}`} key={`${selectedRun.runId}-${node.nodeId}`}>
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
      ) : (
        <p className="muted compact">暂无运行记录</p>
      )}
    </div>
  );
}

function VersionList({
  versions,
  selectedAssetId,
  onSelectAsset
}: {
  versions: CanvasSession["versions"];
  selectedAssetId: string;
  onSelectAsset: (assetId: string) => void;
}) {
  return (
    <div className="version-list">
      <h3>版本链</h3>
      {versions.map((version) => {
        const assetId = version.outputAssetIds[0] ?? "";
        return (
          <button
            className={`version-item ${selectedAssetId === assetId ? "active" : ""}`}
            disabled={!assetId}
            key={version.versionId}
            onClick={() => onSelectAsset(assetId)}
            type="button"
          >
            <strong>{version.versionId}</strong>
            <span>{version.action}</span>
            <small>
              {version.sourceNodeId ?? "-"} / {version.providerId ?? "local"}
            </small>
          </button>
        );
      })}
    </div>
  );
}

function TracePanel({
  selectedAssetId,
  trace,
  traceStatus
}: {
  selectedAssetId: string;
  trace: AssetProvenance | null;
  traceStatus: string;
}) {
  return (
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
            {step.action ?? "asset"} / {step.model ?? "-"} / {step.sourceNodeId ?? "-"}
          </small>
          {step.parentAssetIds.length > 0 ? <small>父级 {step.parentAssetIds.join(", ")}</small> : null}
        </div>
      ))}
      {!traceStatus && !trace ? <p className="muted compact">暂无来源链</p> : null}
    </div>
  );
}

function RagPanel({
  selectedAssetId,
  events,
  ragStatus
}: {
  selectedAssetId: string;
  events: RagEvent[];
  ragStatus: string;
}) {
  return (
    <div className="rag-panel">
      <div className="history-run-head">
        <strong>RAG 复盘</strong>
        <span>{selectedAssetId || "-"}</span>
      </div>
      {ragStatus ? <p className="muted compact">{ragStatus}</p> : null}
      {events.map((event) => (
        <div className={`rag-event ${event.status}`} key={event.event_id}>
          <div>
            <strong>{event.action}</strong>
            <span>{event.latency_ms}ms</span>
          </div>
          <p>{event.prompt}</p>
          <small>
            {event.model} / {event.flow_id ?? event.session_id}
          </small>
        </div>
      ))}
      {!ragStatus && events.length === 0 ? <p className="muted compact">没有匹配的 RAG 事件</p> : null}
    </div>
  );
}

function tabLabel(tab: HistoryTab): string {
  switch (tab) {
    case "runs":
      return "运行";
    case "versions":
      return "版本";
    case "source":
      return "来源";
    case "rag":
      return "RAG";
    default:
      return tab;
  }
}
