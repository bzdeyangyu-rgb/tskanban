import type { CanvasRunRecord, CanvasSession } from "../api/client";

export type RunHistoryModel = {
  runs: NonNullable<CanvasSession["runs"]>;
  versions: CanvasSession["versions"];
  outputAssetIds: string[];
  defaultRunId: string;
  defaultAssetId: string;
};

export function buildRunHistoryModel(session: CanvasSession): RunHistoryModel {
  const runs = [...(session.runs ?? [])].reverse();
  const versions = [...session.versions].reverse();
  const outputAssetIds = Array.from(new Set(versions.flatMap((version) => version.outputAssetIds)));

  return {
    runs,
    versions,
    outputAssetIds,
    defaultRunId: runs[0]?.runId ?? "",
    defaultAssetId: outputAssetIds[0] ?? ""
  };
}

export function findRunById(model: RunHistoryModel, runId: string): CanvasRunRecord | undefined {
  return model.runs.find((run) => run.runId === runId);
}
