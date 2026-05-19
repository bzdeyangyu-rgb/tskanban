import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

export function CanvasApp() {
  return (
    <div className="tldraw-host">
      <Tldraw persistenceKey="tshuabu-phase-one-canvas" />
    </div>
  );
}
