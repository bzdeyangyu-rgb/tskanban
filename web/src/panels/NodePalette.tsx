import { Braces, Image, MessageSquareText, Paintbrush, ScanLine, WandSparkles } from "lucide-react";

const nodeButtons = [
  { label: "图片节点", icon: Image },
  { label: "Prompt 节点", icon: MessageSquareText },
  { label: "文生图 API", icon: WandSparkles },
  { label: "图生图 API", icon: Paintbrush },
  { label: "局部重绘 API", icon: ScanLine },
  { label: "Output 节点", icon: Braces }
];

export function NodePalette() {
  return (
    <nav className="panel-stack">
      <h2 className="panel-heading">节点</h2>
      {nodeButtons.map(({ label, icon: Icon }) => (
        <button className="node-button" type="button" key={label}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
