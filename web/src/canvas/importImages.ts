const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function isSupportedImageFile(file: File): boolean {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  const name = file.name.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function imageFilesFromList(files: Iterable<File>): File[] {
  return [...files].filter(isSupportedImageFile);
}

export function imageFilesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = [];

  for (const item of Array.from(items)) {
    if (item.kind !== "file") {
      continue;
    }

    const file = item.getAsFile();
    if (file && isSupportedImageFile(file)) {
      files.push(file);
    }
  }

  return files;
}
