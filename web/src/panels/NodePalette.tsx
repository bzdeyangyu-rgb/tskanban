import { ArrowRight, Braces, Clapperboard, Image, MessageSquareText, Paintbrush, ScanLine, WandSparkles } from "lucide-react";
import type { CanvasNodeKind } from "../canvas/flowTypes";

const nodeButtons = [
  { label: "图片节点", type: "image", icon: Image },
  { label: "Prompt 节点", type: "prompt", icon: MessageSquareText },
  { label: "文生图 API", type: "api_text2img", icon: WandSparkles },
  { label: "图生图 API", type: "api_img2img", icon: Paintbrush },
  { label: "局部重绘 API", type: "api_inpaint", icon: ScanLine },
  { label: "视频 API", type: "video", icon: Clapperboard },
  { label: "Output 节点", type: "output", icon: Braces }
] satisfies Array<{ label: string; type: CanvasNodeKind; icon: typeof Image }>;

export function NodePalette({
  disabled,
  onAddNode,
  onConnectMode
}: {
  disabled?: boolean;
  onAddNode: (type: CanvasNodeKind) => void;
  onConnectMode: () => void;
}) {
  return (
    <nav className="panel-stack">
      <h2 className="panel-heading">节点</h2>
      {nodeButtons.map(({ label, type, icon: Icon }) => (
        <button className="node-button" type="button" key={label} disabled={disabled} onClick={() => onAddNode(type)}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
      <button className="node-button connect-button" type="button" disabled={disabled} onClick={onConnectMode}>
        <ArrowRight aria-hidden="true" />
        <span>连接箭头</span>
      </button>
    </nav>
  );
}
