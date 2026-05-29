import type { CanvasRunRecord, CanvasSession } from "../api/client";

export type RunHistoryModel = {
  runs: NonNullable<CanvasSession["runs"]>;
  versions: CanvasSession["versions"];
  outputAssetIds: string[];
  outputAssets: Array<{ assetId: string; sourceRunId?: string; sourceNodeId?: string; versionId?: string; action?: string; status?: string }>;
  stats: {
    runCount: number;
    successCount: number;
    failedCount: number;
    outputCount: number;
    totalLatencyMs: number;
    nodeCount: number;
  };
  defaultRunId: string;
  defaultAssetId: string;
};

export function buildRunHistoryModel(session: CanvasSession): RunHistoryModel {
  const runs = [...(session.runs ?? [])].reverse();
  const versions = [...session.versions].reverse();
  const outputAssets = buildOutputAssets(versions);
  const outputAssetIds = outputAssets.map((asset) => asset.assetId);
  const stats = {
    runCount: runs.length,
    successCount: runs.filter((run) => run.status === "success").length,
    failedCount: runs.filter((run) => run.status === "failed").length,
    outputCount: outputAssetIds.length,
    totalLatencyMs: runs.reduce((sum, run) => sum + run.latencyMs, 0),
    nodeCount: runs.reduce((sum, run) => sum + run.nodes.length, 0)
  };

  return {
    runs,
    versions,
    outputAssetIds,
    outputAssets,
    stats,
    defaultRunId: runs[0]?.runId ?? "",
    defaultAssetId: outputAssetIds[0] ?? ""
  };
}

export function findRunById(model: RunHistoryModel, runId: string): CanvasRunRecord | undefined {
  return model.runs.find((run) => run.runId === runId);
}

function buildOutputAssets(versions: CanvasSession["versions"]): RunHistoryModel["outputAssets"] {
  const seen = new Set<string>();
  const assets: RunHistoryModel["outputAssets"] = [];
  for (const version of versions) {
    for (const assetId of version.outputAssetIds) {
      if (seen.has(assetId)) {
        continue;
      }
      seen.add(assetId);
      assets.push({
        assetId,
        sourceRunId: version.sourceRunId,
        sourceNodeId: version.sourceNodeId,
        versionId: version.versionId,
        action: version.action,
        status: version.status
      });
    }
  }
  return assets;
}
