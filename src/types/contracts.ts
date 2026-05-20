import { z } from "zod";

export const uploadBodySchema = z.object({
  kind: z.enum(["base", "mask", "reference"]).default("reference"),
  sessionId: z.string().optional(),
  roleTag: z.string().min(1).max(40).optional()
});

export const createSessionSchema = z.object({
  title: z.string().min(1).optional()
});

export const text2imgSchema = z.object({
  sessionId: z.string().optional(),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional()
});

export const inpaintSchema = z.object({
  sessionId: z.string().optional(),
  parentVersionId: z.string().optional(),
  baseAssetId: z.string().min(1),
  maskAssetId: z.string().min(1),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  selection: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      canvasWidth: z.number(),
      canvasHeight: z.number(),
      localPrompt: z.string().optional()
    })
    .optional()
});

export const img2imgSchema = z.object({
  sessionId: z.string().optional(),
  parentVersionId: z.string().optional(),
  baseAssetId: z.string().min(1),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional()
});

export const providerProtocolSchema = z.enum(["openai", "apimart"]);

export const apiProviderSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  baseUrl: z.string().url(),
  protocol: providerProtocolSchema.default("openai"),
  enabled: z.boolean().default(true),
  primary: z.boolean().default(false),
  apiKey: z.string().optional(),
  imageModels: z.array(z.string()).default([]),
  chatModels: z.array(z.string()).default([]),
  videoModels: z.array(z.string()).default([])
});

export const saveProvidersSchema = z.object({
  providers: z.array(apiProviderSchema).min(1)
});

export const providerConnectionSchema = z.object({
  providerId: z.string().optional(),
  baseUrl: z.string().url(),
  apiKey: z.string().optional()
});

export const canvasNodeTypeSchema = z.enum([
  "image",
  "prompt",
  "api_text2img",
  "api_img2img",
  "api_inpaint",
  "output",
  "comfy",
  "llm",
  "loop",
  "video"
]);

export const canvasNodeStatusSchema = z.enum(["idle", "queued", "running", "success", "failed", "retrying"]);

export const canvasNodeSchema = z.object({
  id: z.string().min(1),
  type: canvasNodeTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  data: z.record(z.string(), z.unknown()).default({}),
  status: canvasNodeStatusSchema.optional()
});

export const canvasEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  fromHandle: z.string().optional(),
  toHandle: z.string().optional()
});

export const canvasViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive()
});

export const canvasSnapshotSchema = z.object({
  canvasId: z.string().min(1),
  sessionId: z.string().optional(),
  nodes: z.array(canvasNodeSchema).min(1),
  edges: z.array(canvasEdgeSchema),
  viewport: canvasViewportSchema,
  selectedNodeId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const canvasExecuteSchema = z.object({
  sessionId: z.string().optional(),
  targetNodeId: z.string().optional(),
  flow: canvasSnapshotSchema
});

export const createCanvasSchema = z.object({
  canvasId: z.string().min(1).optional(),
  sessionId: z.string().optional(),
  title: z.string().min(1).optional()
});

export const saveCanvasSchema = canvasSnapshotSchema.extend({
  title: z.string().min(1).default("未命名画布")
});

export const flowNodeTypeSchema = z.enum([
  "asset_base",
  "asset_style",
  "prompt",
  "text2img",
  "mask",
  "inpaint",
  "output"
]);

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: flowNodeTypeSchema,
  label: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional()
});

export const flowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1)
});

export const flowSchema = z.object({
  nodes: z.array(flowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema)
});

export const flowRunSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  parentVersionId: z.string().optional(),
  baseAssetId: z.string().optional(),
  styleAssetId: z.string().optional(),
  maskAssetId: z.string().optional(),
  selection: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      canvasWidth: z.number(),
      canvasHeight: z.number(),
      localPrompt: z.string().optional()
    })
    .optional()
});

export const flowValidateSchema = z.object({
  flow: canvasSnapshotSchema
});

export const flowExecuteSchema = z.object({
  sessionId: z.string().optional(),
  flow: flowSchema,
  run: flowRunSchema
});

export const logsQuerySchema = z.object({
  sessionId: z.string().optional(),
  action: z.string().optional(),
  model: z.string().optional(),
  keyword: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50)
});
