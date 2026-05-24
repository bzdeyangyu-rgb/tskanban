const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function imageFilesFromList(files: Iterable<File>): File[] {
  return [...files].filter((file) => SUPPORTED_IMAGE_TYPES.has(file.type));
}

export function imageFilesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = [];

  for (const item of Array.from(items)) {
    if (item.kind !== "file") {
      continue;
    }

    const file = item.getAsFile();
    if (file && SUPPORTED_IMAGE_TYPES.has(file.type)) {
      files.push(file);
    }
  }

  return files;
}
