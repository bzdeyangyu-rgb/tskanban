import "dotenv/config";
import { z } from "zod";
import { generateImage } from "./imageApi";
import { createBaseEvent, createSessionId, logEvent, readLatestEvents } from "./logger";
import { findTemplate, listTemplates, saveTemplate } from "./templates";

type Command =
  | "run:text2img"
  | "run:inpaint"
  | "show:latest-logs"
  | "template:save"
  | "template:list"
  | "template:use";

const runText2ImgSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  size: z.string().optional(),
  steps: z.coerce.number().int().positive().optional(),
  strength: z.coerce.number().min(0).max(1).optional(),
  seed: z.coerce.number().int().optional(),
  sessionId: z.string().optional()
});

const runInpaintSchema = runText2ImgSchema.extend({
  inputImage: z.string().min(1),
  maskImage: z.string().min(1)
});

const showLogsSchema = z.object({
  limit: z.coerce.number().int().positive().default(5)
});

const saveTemplateSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional()
});

const useTemplateSchema = z.object({
  name: z.string().min(1)
});

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || !token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }

    out[key] = next;
    i += 1;
  }

  return out;
}

function printUsage() {
  console.log(`Usage:
  npm run dev -- run:text2img --model xxx --prompt "..." [--negativePrompt "..."] [--size 1024x1024] [--steps 30] [--strength 0.5] [--seed 123]
  npm run dev -- run:inpaint --model xxx --prompt "..." --inputImage outputs/base.png --maskImage outputs/mask.png
  npm run dev -- show:latest-logs [--limit 5]
  npm run dev -- template:save --name cinematic --prompt "..." [--negativePrompt "..."]
  npm run dev -- template:list
  npm run dev -- template:use --name cinematic
`);
}

async function handleRunText2Img(rawArgs: Record<string, string>) {
  const input = runText2ImgSchema.parse(rawArgs);
  const sessionId = input.sessionId ?? createSessionId();

  const base = createBaseEvent({
    sessionId,
    action: "text2img",
    model: input.model,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    params: {
      size: input.size,
      steps: input.steps,
      strength: input.strength,
      seed: input.seed
    }
  });

  const start = Date.now();

  try {
    const result = await generateImage({
      action: "text2img",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: {
        size: input.size,
        steps: input.steps,
        strength: input.strength,
        seed: input.seed
      }
    });

    await logEvent({
      ...base,
      output_assets: result.outputAssets,
      status: "success",
      latency_ms: Date.now() - start
    });

    console.log(JSON.stringify({ sessionId, outputAssets: result.outputAssets }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEvent({
      ...base,
      output_assets: [],
      status: "failed",
      latency_ms: Date.now() - start,
      error_message: message
    });
    throw error;
  }
}

async function handleRunInpaint(rawArgs: Record<string, string>) {
  const input = runInpaintSchema.parse(rawArgs);
  const sessionId = input.sessionId ?? createSessionId();

  const base = createBaseEvent({
    sessionId,
    action: "inpaint",
    model: input.model,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    params: {
      size: input.size,
      steps: input.steps,
      strength: input.strength,
      seed: input.seed
    },
    inputAssets: [input.inputImage, input.maskImage]
  });

  const start = Date.now();

  try {
    const result = await generateImage({
      action: "inpaint",
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: {
        size: input.size,
        steps: input.steps,
        strength: input.strength,
        seed: input.seed
      },
      inputImage: input.inputImage,
      maskImage: input.maskImage
    });

    await logEvent({
      ...base,
      output_assets: result.outputAssets,
      status: "success",
      latency_ms: Date.now() - start
    });

    console.log(JSON.stringify({ sessionId, outputAssets: result.outputAssets }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEvent({
      ...base,
      output_assets: [],
      status: "failed",
      latency_ms: Date.now() - start,
      error_message: message
    });
    throw error;
  }
}

async function handleShowLatestLogs(rawArgs: Record<string, string>) {
  const input = showLogsSchema.parse(rawArgs);
  const events = await readLatestEvents(input.limit);
  console.log(JSON.stringify(events, null, 2));
}

async function handleTemplateSave(rawArgs: Record<string, string>) {
  const input = saveTemplateSchema.parse(rawArgs);
  const template = await saveTemplate(input);
  console.log(JSON.stringify(template, null, 2));
}

async function handleTemplateList() {
  const templates = await listTemplates();
  console.log(JSON.stringify(templates, null, 2));
}

async function handleTemplateUse(rawArgs: Record<string, string>) {
  const input = useTemplateSchema.parse(rawArgs);
  const template = await findTemplate(input.name);
  if (!template) {
    throw new Error(`Template not found: ${input.name}`);
  }

  console.log(JSON.stringify(template, null, 2));
}

async function main() {
  const [commandRaw, ...rest] = process.argv.slice(2);
  const command = commandRaw as Command | undefined;

  if (!command) {
    printUsage();
    process.exit(1);
  }

  const args = parseArgs(rest);

  switch (command) {
    case "run:text2img":
      await handleRunText2Img(args);
      break;
    case "run:inpaint":
      await handleRunInpaint(args);
      break;
    case "show:latest-logs":
      await handleShowLatestLogs(args);
      break;
    case "template:save":
      await handleTemplateSave(args);
      break;
    case "template:list":
      await handleTemplateList();
      break;
    case "template:use":
      await handleTemplateUse(args);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
