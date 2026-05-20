import { Tldraw, type Editor } from "tldraw";
import { imageFilesFromClipboard, imageFilesFromList } from "./importImages";
import { TshuabuNodeShapeUtil } from "./TshuabuNodeShapeUtil";
import "tldraw/tldraw.css";

const shapeUtils = [TshuabuNodeShapeUtil];

export function CanvasApp({
  onFiles,
  onMount
}: {
  onFiles?: (files: File[]) => void;
  onMount?: (editor: Editor) => void;
}) {
  return (
    <div
      className="tldraw-host"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const files = imageFilesFromList(event.dataTransfer.files);
        if (files.length > 0) {
          event.preventDefault();
          onFiles?.(files);
        }
      }}
      onPaste={(event) => {
        const files = imageFilesFromClipboard(event.clipboardData.items);
        if (files.length > 0) {
          event.preventDefault();
          onFiles?.(files);
        }
      }}
    >
      <Tldraw persistenceKey="tshuabu-phase-one-canvas" shapeUtils={shapeUtils} onMount={onMount} />
    </div>
  );
}
