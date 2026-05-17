import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export type PromptTemplate = {
  id: string;
  name: string;
  prompt: string;
  negativePrompt?: string | undefined;
  createdAt: string;
};

const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  negativePrompt: z.string().optional(),
  createdAt: z.string()
});

const ROOT = process.cwd();
const PROMPT_DIR = path.join(ROOT, "prompts");
const TEMPLATE_PATH = path.join(PROMPT_DIR, "templates.json");

async function ensureTemplateFile() {
  await mkdir(PROMPT_DIR, { recursive: true });
  const exists = await readFile(TEMPLATE_PATH, "utf8").catch(() => "");
  if (!exists.trim()) {
    await writeFile(TEMPLATE_PATH, "[]\n", "utf8");
  }
}

export async function listTemplates(): Promise<PromptTemplate[]> {
  await ensureTemplateFile();
  const raw = await readFile(TEMPLATE_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  const result: PromptTemplate[] = [];
  for (const item of parsed) {
    const validated = templateSchema.safeParse(item);
    if (validated.success) {
      result.push(validated.data);
    }
  }

  return result;
}

export async function saveTemplate(input: {
  name: string;
  prompt: string;
  negativePrompt?: string | undefined;
}): Promise<PromptTemplate> {
  const templates = await listTemplates();
  const next: PromptTemplate = {
    id: randomUUID(),
    name: input.name,
    prompt: input.prompt,
    createdAt: new Date().toISOString()
  };

  if (input.negativePrompt !== undefined) {
    next.negativePrompt = input.negativePrompt;
  }

  templates.push(next);
  await writeFile(TEMPLATE_PATH, `${JSON.stringify(templates, null, 2)}\n`, "utf8");
  return next;
}

export async function findTemplate(name: string): Promise<PromptTemplate | undefined> {
  const templates = await listTemplates();
  return templates.find((t) => t.name === name);
}
