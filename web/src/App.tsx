import { CanvasApp } from "./canvas/CanvasApp";
import { Inspector } from "./panels/Inspector";
import { NodePalette } from "./panels/NodePalette";
import { RunPanel } from "./panels/RunPanel";

export function App() {
  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="节点栏">
        <NodePalette />
      </aside>
      <section className="workspace" aria-label="画布">
        <CanvasApp />
        <RunPanel />
      </section>
      <aside className="side-panel" aria-label="属性栏">
        <Inspector />
      </aside>
    </main>
  );
}
