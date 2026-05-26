export type ApiFeaturePageId = "zimage" | "enhance" | "klein" | "angle" | "online" | "gpt-chat";

export type FeatureField = {
  key: string;
  label: string;
  type: "text" | "select" | "range" | "number";
  options?: string[];
  defaultValue: string;
};

export type FeaturePageConfig = {
  uploadLabel?: string;
  promptLabel: string;
  previewTitle: string;
  managementTitle: string;
  hasNegativePrompt: boolean;
  fields: FeatureField[];
};

export type FeatureManagementStat = {
  label: string;
  value: string;
};

const featurePageConfigs: Record<ApiFeaturePageId, FeaturePageConfig> = {
  zimage: {
    promptLabel: "输入提示词",
    previewTitle: "生成预览",
    managementTitle: "批量管理 / 版本管理",
    hasNegativePrompt: true,
    fields: [
      { key: "size", label: "尺寸", type: "select", options: ["1024x1024", "1024x1536", "1536x1024", "768x1344"], defaultValue: "1024x1024" },
      { key: "batch", label: "批量", type: "number", defaultValue: "1" },
      { key: "style", label: "风格", type: "text", defaultValue: "" }
    ]
  },
  enhance: {
    uploadLabel: "输入图片",
    promptLabel: "增强说明",
    previewTitle: "画布预览",
    managementTitle: "增强记录管理",
    hasNegativePrompt: false,
    fields: [
      { key: "strength", label: "增强程度", type: "range", defaultValue: "60" },
      { key: "scale", label: "放大倍率", type: "select", options: ["1x", "2x", "4x"], defaultValue: "2x" },
      { key: "detail", label: "细节保真", type: "range", defaultValue: "70" }
    ]
  },
  klein: {
    uploadLabel: "参考图片",
    promptLabel: "输入提示词",
    previewTitle: "编辑预览",
    managementTitle: "图片编辑管理",
    hasNegativePrompt: false,
    fields: [
      { key: "mask", label: "蒙版模式", type: "select", options: ["自动识别", "手动蒙版", "全图编辑"], defaultValue: "自动识别" },
      { key: "strength", label: "编辑强度", type: "range", defaultValue: "55" },
      { key: "reference", label: "参考权重", type: "range", defaultValue: "65" }
    ]
  },
  angle: {
    uploadLabel: "输入图片",
    promptLabel: "角度说明",
    previewTitle: "结果预览",
    managementTitle: "角度版本管理",
    hasNegativePrompt: false,
    fields: [
      { key: "camera", label: "相机控制", type: "select", options: ["正面", "左 45°", "右 45°", "俯视", "低角度"], defaultValue: "左 45°" },
      { key: "focal", label: "焦距", type: "select", options: ["24mm", "35mm", "50mm", "85mm"], defaultValue: "35mm" },
      { key: "strength", label: "参数强度", type: "range", defaultValue: "50" }
    ]
  },
  online: {
    promptLabel: "在线提示词",
    previewTitle: "在线结果",
    managementTitle: "在线任务管理",
    hasNegativePrompt: true,
    fields: [
      { key: "source", label: "平台", type: "select", options: ["API Provider", "远程队列"], defaultValue: "API Provider" },
      { key: "size", label: "尺寸", type: "select", options: ["1024x1024", "1024x1536", "1536x1024"], defaultValue: "1024x1024" },
      { key: "batch", label: "批量", type: "number", defaultValue: "1" }
    ]
  },
  "gpt-chat": {
    promptLabel: "对话内容",
    previewTitle: "回复预览",
    managementTitle: "对话记录",
    hasNegativePrompt: false,
    fields: [
      { key: "mode", label: "模式", type: "select", options: ["提示词优化", "流程建议", "创意讨论"], defaultValue: "提示词优化" },
      { key: "context", label: "上下文", type: "text", defaultValue: "" }
    ]
  }
};

const featureManagementStats: Record<ApiFeaturePageId, FeatureManagementStat[]> = {
  zimage: [
    { label: "当前版本", value: "0" },
    { label: "批量队列", value: "0" },
    { label: "历史记录", value: "0" }
  ],
  enhance: [
    { label: "增强记录", value: "0" },
    { label: "预览版本", value: "0" },
    { label: "历史记录", value: "0" }
  ],
  klein: [
    { label: "编辑版本", value: "0" },
    { label: "参考素材", value: "0" },
    { label: "历史记录", value: "0" }
  ],
  angle: [
    { label: "角度版本", value: "0" },
    { label: "参数预设", value: "0" },
    { label: "历史记录", value: "0" }
  ],
  online: [
    { label: "在线任务", value: "0" },
    { label: "批量队列", value: "0" },
    { label: "历史记录", value: "0" }
  ],
  "gpt-chat": [
    { label: "对话轮次", value: "0" },
    { label: "提示词版本", value: "0" },
    { label: "历史记录", value: "0" }
  ]
};

export function featurePageConfig(pageId: ApiFeaturePageId): FeaturePageConfig {
  return featurePageConfigs[pageId];
}

export function managementStatsForFeature(pageId: ApiFeaturePageId): FeatureManagementStat[] {
  return featureManagementStats[pageId];
}
