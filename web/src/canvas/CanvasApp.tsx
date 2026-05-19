import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";

export function CanvasApp({ onMount }: { onMount?: (editor: Editor) => void }) {
  return (
    <div className="tldraw-host">
      <Tldraw persistenceKey="tshuabu-phase-one-canvas" onMount={onMount} />
    </div>
  );
}
