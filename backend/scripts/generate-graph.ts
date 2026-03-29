import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const MODELS = ['claude-opus-4-5', 'claude-3-5-sonnet-20241022'] as const;
const MAX_TOKENS = 8000;

const SKILL_CATEGORIES = ['Technique', 'Rudiment', 'Groove', 'Coordination', 'Theory'] as const;
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Professional'] as const;

type SkillCategory = (typeof SKILL_CATEGORIES)[number];
type SkillLevel = (typeof SKILL_LEVELS)[number];

interface SeedSkill {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  hasBpmTarget: boolean;
  description: string;
  prerequisiteIds: string[];
}

interface SeedExercise {
  id: string;
  name: string;
  description: string;
  notes: string;
  targetBpm: number | null;
  estimatedMinutes: number;
  skillIds: string[];
}

interface SeedGraph {
  skills: SeedSkill[];
  exercises: SeedExercise[];
}

const BACKEND_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const OUTPUT_JSON = path.join(DATA_DIR, 'seed-graph.json');
const RAW_DEBUG = path.join(DATA_DIR, 'seed-graph-raw.txt');

const GENERATION_PROMPT = `You are generating seed data for Drumpath, a drum learning application.

Produce a single JSON document that matches this TypeScript shape exactly:

\`\`\`ts
type SkillCategory = 'Technique' | 'Rudiment' | 'Groove' | 'Coordination' | 'Theory';
type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional';

interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  hasBpmTarget: boolean;
  description: string;
  prerequisiteIds: string[]; // IDs of other skills in this same output
}

interface Exercise {
  id: string;
  name: string;
  description: string;
  notes: string;
  targetBpm: number | null;
  estimatedMinutes: number;
  skillIds: string[]; // 1–2 skill IDs from this same output
}

interface Output {
  skills: Skill[];
  exercises: Exercise[];
}
\`\`\`

Requirements:
- **30–40 skills** across categories: Technique, Rudiment, Groove, Coordination, Theory.
- **Level distribution:** at least 10 Beginner, at least 10 Intermediate, at least 5 Advanced, at least 2 Professional.
- **Prerequisites:** Every skill that is not Beginner must list at least one \`prerequisiteIds\` entry that references a valid \`skills[].id\` from this same document. Beginner skills use \`prerequisiteIds: []\`.
- **50–60 exercises:** concrete practice tasks (not abstract skills). Each exercise must reference **1 or 2** skill IDs in \`skillIds\`, and every ID must exist in \`skills\`.
- Set \`hasBpmTarget: true\` and a numeric \`targetBpm\` on exercises where tempo practice applies (rudiments, grooves, many coordination items). Technique-focused work may use \`hasBpmTarget: false\` on the skill and \`targetBpm: null\` on related exercises when tempo is not the focus.
- **estimatedMinutes:** realistic integers between 5 and 15 per exercise.
- Use stable string IDs like \`s1\`, \`s2\`, … for skills and \`e1\`, \`e2\`, … for exercises (or similar), ensuring uniqueness within the document.
- **No extra keys** at the top level beyond \`skills\` and \`exercises\`.

Output format: wrap the **raw JSON only** (no markdown fences inside) in XML-style tags exactly like this:

<json>
{ ... your JSON here ... }
</json>`;

function isSkillCategory(v: unknown): v is SkillCategory {
  return typeof v === 'string' && (SKILL_CATEGORIES as readonly string[]).includes(v);
}

function isSkillLevel(v: unknown): v is SkillLevel {
  return typeof v === 'string' && (SKILL_LEVELS as readonly string[]).includes(v);
}

function isModelFallbackError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: number; error?: { type?: string; message?: string } };
  if (anyErr.status === 404) return true;
  const msg = String(anyErr.error?.message ?? '');
  const type = String(anyErr.error?.type ?? '');
  if (/model/i.test(msg) && /not found|invalid|unsupported/i.test(msg)) return true;
  if (type === 'not_found_error') return true;
  return false;
}

function extractJsonFromTags(text: string): string | null {
  const open = text.indexOf('<json>');
  const close = text.indexOf('</json>');
  if (open === -1 || close === -1 || close <= open) return null;
  return text.slice(open + '<json>'.length, close).trim();
}

function messageTextContent(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function validateSeedGraph(data: unknown): SeedGraph {
  if (!data || typeof data !== 'object') {
    throw new Error('Root value must be an object');
  }
  const root = data as Record<string, unknown>;
  if (!Array.isArray(root.skills) || !Array.isArray(root.exercises)) {
    throw new Error('Root must have skills and exercises arrays');
  }

  const skills: SeedSkill[] = [];
  for (let i = 0; i < root.skills.length; i++) {
    const s = root.skills[i];
    if (!s || typeof s !== 'object') throw new Error(`skills[${i}] must be an object`);
    const o = s as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id.trim()) throw new Error(`skills[${i}].id must be a non-empty string`);
    if (typeof o.name !== 'string' || !o.name.trim()) throw new Error(`skills[${i}].name invalid`);
    if (!isSkillCategory(o.category)) throw new Error(`skills[${i}].category must be one of: ${SKILL_CATEGORIES.join(', ')}`);
    if (!isSkillLevel(o.level)) throw new Error(`skills[${i}].level must be one of: ${SKILL_LEVELS.join(', ')}`);
    if (typeof o.hasBpmTarget !== 'boolean') throw new Error(`skills[${i}].hasBpmTarget must be boolean`);
    if (typeof o.description !== 'string') throw new Error(`skills[${i}].description must be string`);
    if (!Array.isArray(o.prerequisiteIds)) throw new Error(`skills[${i}].prerequisiteIds must be an array`);
    if (!o.prerequisiteIds.every((id): id is string => typeof id === 'string')) {
      throw new Error(`skills[${i}].prerequisiteIds must be string[]`);
    }
    skills.push({
      id: o.id,
      name: o.name,
      category: o.category,
      level: o.level,
      hasBpmTarget: o.hasBpmTarget,
      description: o.description,
      prerequisiteIds: o.prerequisiteIds
    });
  }

  const skillIds = new Set(skills.map((s) => s.id));
  if (skillIds.size !== skills.length) throw new Error('Duplicate skill ids');

  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    for (const pre of s.prerequisiteIds) {
      if (!skillIds.has(pre)) {
        throw new Error(`skills[${i}].prerequisiteIds references unknown skill id: ${pre}`);
      }
    }
    if (s.level !== 'Beginner' && s.prerequisiteIds.length === 0) {
      throw new Error(`skills[${i}] (${s.id}) is not Beginner but has no prerequisites`);
    }
    if (s.level === 'Beginner' && s.prerequisiteIds.length > 0) {
      throw new Error(`skills[${i}] (${s.id}) is Beginner but has prerequisites`);
    }
  }

  const exercises: SeedExercise[] = [];
  for (let i = 0; i < root.exercises.length; i++) {
    const e = root.exercises[i];
    if (!e || typeof e !== 'object') throw new Error(`exercises[${i}] must be an object`);
    const o = e as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id.trim()) throw new Error(`exercises[${i}].id invalid`);
    if (typeof o.name !== 'string' || !o.name.trim()) throw new Error(`exercises[${i}].name invalid`);
    if (typeof o.description !== 'string') throw new Error(`exercises[${i}].description must be string`);
    if (typeof o.notes !== 'string') throw new Error(`exercises[${i}].notes must be string`);
    if (o.targetBpm !== null && (typeof o.targetBpm !== 'number' || !Number.isFinite(o.targetBpm))) {
      throw new Error(`exercises[${i}].targetBpm must be number or null`);
    }
    if (typeof o.estimatedMinutes !== 'number' || !Number.isFinite(o.estimatedMinutes)) {
      throw new Error(`exercises[${i}].estimatedMinutes must be a finite number`);
    }
    if (!Number.isInteger(o.estimatedMinutes)) {
      throw new Error(`exercises[${i}].estimatedMinutes must be an integer`);
    }
    if (o.estimatedMinutes < 5 || o.estimatedMinutes > 15) {
      throw new Error(`exercises[${i}].estimatedMinutes must be between 5 and 15`);
    }
    if (!Array.isArray(o.skillIds)) throw new Error(`exercises[${i}].skillIds must be an array`);
    if (o.skillIds.length < 1 || o.skillIds.length > 2) {
      throw new Error(`exercises[${i}].skillIds must have 1 or 2 entries`);
    }
    if (!o.skillIds.every((id): id is string => typeof id === 'string')) {
      throw new Error(`exercises[${i}].skillIds must be string[]`);
    }
    for (const sid of o.skillIds) {
      if (!skillIds.has(sid)) {
        throw new Error(`exercises[${i}].skillIds references unknown skill: ${sid}`);
      }
    }
    exercises.push({
      id: o.id,
      name: o.name,
      description: o.description,
      notes: o.notes,
      targetBpm: o.targetBpm as number | null,
      estimatedMinutes: o.estimatedMinutes,
      skillIds: o.skillIds
    });
  }

  const exerciseIds = new Set(exercises.map((e) => e.id));
  if (exerciseIds.size !== exercises.length) throw new Error('Duplicate exercise ids');

  const graph: SeedGraph = { skills, exercises };
  validateGraphCounts(graph);
  return graph;
}

function validateGraphCounts(graph: SeedGraph): void {
  const { skills, exercises } = graph;
  if (skills.length < 30 || skills.length > 40) {
    throw new Error(`Expected 30–40 skills, got ${skills.length}`);
  }
  if (exercises.length < 50 || exercises.length > 60) {
    throw new Error(`Expected 50–60 exercises, got ${exercises.length}`);
  }
  const levelCounts: Record<SkillLevel, number> = {
    Beginner: 0,
    Intermediate: 0,
    Advanced: 0,
    Professional: 0
  };
  for (const s of skills) {
    levelCounts[s.level] += 1;
  }
  if (levelCounts.Beginner < 10) throw new Error(`Need at least 10 Beginner skills, got ${levelCounts.Beginner}`);
  if (levelCounts.Intermediate < 10) {
    throw new Error(`Need at least 10 Intermediate skills, got ${levelCounts.Intermediate}`);
  }
  if (levelCounts.Advanced < 5) throw new Error(`Need at least 5 Advanced skills, got ${levelCounts.Advanced}`);
  if (levelCounts.Professional < 2) {
    throw new Error(`Need at least 2 Professional skills, got ${levelCounts.Professional}`);
  }
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function callAnthropic(apiKey: string, prompt: string): Promise<{ model: string; text: string }> {
  const client = new Anthropic({ apiKey });
  let lastError: unknown;

  for (const model of MODELS) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      });
      return { model, text: messageTextContent(message) };
    } catch (err) {
      lastError = err;
      if (model !== MODELS[MODELS.length - 1] && isModelFallbackError(err)) {
        console.warn(`Model ${model} unavailable; trying fallback...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('No model succeeded');
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY in environment (.env or shell).');
    process.exit(1);
  }

  await ensureDataDir();

  let rawText: string;
  try {
    const { model, text } = await callAnthropic(apiKey, GENERATION_PROMPT);
    rawText = text;
    console.log(`Anthropic response received (model: ${model}).`);
  } catch (err) {
    console.error('Anthropic API error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const jsonSlice = extractJsonFromTags(rawText);
  if (!jsonSlice) {
    console.error('Could not find <json>...</json> in the model response.');
    await fs.writeFile(RAW_DEBUG, rawText, 'utf8');
    console.error(`Wrote raw response to ${path.relative(BACKEND_ROOT, RAW_DEBUG)}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice) as unknown;
  } catch (e) {
    console.error('JSON.parse failed:', e instanceof Error ? e.message : e);
    await fs.writeFile(RAW_DEBUG, rawText, 'utf8');
    console.error(`Wrote raw response to ${path.relative(BACKEND_ROOT, RAW_DEBUG)}`);
    process.exit(1);
  }

  try {
    const graph = validateSeedGraph(parsed);
    await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(BACKEND_ROOT, OUTPUT_JSON)}`);
    console.log(`Summary: ${graph.skills.length} skills, ${graph.exercises.length} exercises.`);
  } catch (e) {
    console.error('Validation failed:', e instanceof Error ? e.message : e);
    await fs.writeFile(RAW_DEBUG, rawText, 'utf8');
    console.error(`Wrote raw response to ${path.relative(BACKEND_ROOT, RAW_DEBUG)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
