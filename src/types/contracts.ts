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
  flow: flowSchema
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
