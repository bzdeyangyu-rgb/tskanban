import {
  ArrowRight,
  Braces,
  Clapperboard,
  Image,
  MessageSquareText,
  Paintbrush,
  Repeat2,
  ScanLine,
  WandSparkles,
  Workflow
} from "lucide-react";
import type { CanvasNodeKind } from "../canvas/flowTypes";

const nodeButtons = [
  { label: "图片", type: "image", icon: Image },
  { label: "提示词", type: "prompt", icon: MessageSquareText },
  { label: "循环", type: "loop", icon: Repeat2 },
  { label: "LLM", type: "llm", icon: MessageSquareText },
  { label: "文生图", type: "api_text2img", icon: WandSparkles },
  { label: "图生图", type: "api_img2img", icon: Paintbrush },
  { label: "局部重绘", type: "api_inpaint", icon: ScanLine },
  { label: "视频", type: "video", icon: Clapperboard },
  { label: "ComfyUI", type: "comfy", icon: Workflow },
  { label: "输出", type: "output", icon: Braces }
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
    <nav className="panel-stack node-library">
      <div className="panel-title-row">
        <h2 className="panel-heading">节点</h2>
        <button className="mini-button tool-pill" type="button" disabled={disabled} onClick={onConnectMode}>
          <ArrowRight aria-hidden="true" />
          <span>连接</span>
        </button>
      </div>
      <div className="node-button-grid">
        {nodeButtons.map(({ label, type, icon: Icon }) => (
          <button className="node-button" type="button" key={label} disabled={disabled} onClick={() => onAddNode(type)}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
