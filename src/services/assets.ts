import path from "node:path";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { writeFile, stat } from "node:fs/promises";

export type AssetKind = "base" | "mask" | "generated" | "reference";

export type AssetMeta = {
  assetId: string;
  kind: AssetKind;
  path: string;
  publicUrl: string;
  mime: string;
  size: number;
  createdAt: string;
  createdByVersionId?: string | undefined;
};

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "outputs");

function dayPrefix() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "bin";
}

function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  return "application/octet-stream";
}

export async function saveBufferAsAsset(input: {
  buffer: Buffer;
  kind: AssetKind;
  mimeType: string;
  createdByVersionId?: string | undefined;
}): Promise<AssetMeta> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const day = dayPrefix();
  const dayDir = path.join(OUTPUT_DIR, day);
  await mkdir(dayDir, { recursive: true });

  const assetId = `ast_${randomUUID().slice(0, 8)}`;
  const ext = extensionForMime(input.mimeType);
  const fileName = `${assetId}.${ext}`;
  const absolutePath = path.join(dayDir, fileName);
  await writeFile(absolutePath, input.buffer);
  const fileStat = await stat(absolutePath);

  const relativePath = `/outputs/${day}/${fileName}`;

  return {
    assetId,
    kind: input.kind,
    path: absolutePath,
    publicUrl: relativePath,
    mime: input.mimeType,
    size: fileStat.size,
    createdAt: new Date().toISOString(),
    createdByVersionId: input.createdByVersionId
  };
}

export async function saveDataUrlAsAsset(input: {
  dataUrl: string;
  kind: AssetKind;
  createdByVersionId?: string | undefined;
}): Promise<AssetMeta> {
  const parts = input.dataUrl.split(",");
  if (parts.length !== 2) {
    throw new Error("Invalid data URL");
  }

  const header = parts[0];
  const payload = parts[1];
  if (!header || !payload) {
    throw new Error("Invalid data URL parts");
  }

  const mimeMatch = header.match(/^data:(.*?);base64$/);
  const mimeType = mimeMatch?.[1];
  if (!mimeType) {
    throw new Error("Invalid data URL header");
  }

  const buffer = Buffer.from(payload, "base64");
  return saveBufferAsAsset({
    buffer,
    kind: input.kind,
    mimeType,
    createdByVersionId: input.createdByVersionId
  });
}

export async function saveOutputAsAsset(input: {
  output: string;
  kind: AssetKind;
  createdByVersionId?: string | undefined;
}): Promise<AssetMeta> {
  if (input.output.startsWith("data:")) {
    return saveDataUrlAsAsset({
      dataUrl: input.output,
      kind: input.kind,
      createdByVersionId: input.createdByVersionId
    });
  }

  return {
    assetId: `ast_${randomUUID().slice(0, 8)}`,
    kind: input.kind,
    path: input.output,
    publicUrl: input.output,
    mime: mimeFromUrl(input.output),
    size: 0,
    createdAt: new Date().toISOString(),
    createdByVersionId: input.createdByVersionId
  };
}

export function isSupportedImageMime(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp";
}
