import 'dotenv/config';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

const BACKEND_ROOT = path.join(__dirname, '..');
const SEED_PATH = path.join(BACKEND_ROOT, 'data', 'seed-graph.json');

interface SeedSkill {
  id: string;
  name: string;
  category: string;
  level: string;
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

function parseSeedGraph(raw: unknown): SeedGraph {
  if (!raw || typeof raw !== 'object') {
    throw new Error('seed-graph.json root must be an object');
  }
  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.skills) || !Array.isArray(root.exercises)) {
    throw new Error('seed-graph.json must have skills and exercises arrays');
  }
  return root as unknown as SeedGraph;
}

async function main(): Promise<number> {
  let rawText: string;
  try {
    rawText = await fs.readFile(SEED_PATH, 'utf8');
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
    if (code === 'ENOENT') {
      console.error('seed-graph.json not found. Run generate-graph first.');
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    return 1;
  }

  let graph: SeedGraph;
  try {
    graph = parseSeedGraph(JSON.parse(rawText) as unknown);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return 1;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    return 1;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await pool.end();
    return 1;
  }

  const skillIdMap = new Map<string, string>();
  for (const skill of graph.skills) {
    skillIdMap.set(skill.id, randomUUID());
  }

  const exerciseIdMap = new Map<string, string>();
  for (const ex of graph.exercises) {
    exerciseIdMap.set(ex.id, randomUUID());
  }

  try {
    await client.query('BEGIN');

    for (const skill of graph.skills) {
      const realId = skillIdMap.get(skill.id)!;
      await client.query(
        `INSERT INTO skills (id, name, category, level, has_bpm_target, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [realId, skill.name, skill.category, skill.level, skill.hasBpmTarget, skill.description]
      );
    }

    for (const skill of graph.skills) {
      const skillUuid = skillIdMap.get(skill.id)!;
      for (const preSeedId of skill.prerequisiteIds) {
        const preUuid = skillIdMap.get(preSeedId);
        if (!preUuid) continue;
        await client.query(
          `INSERT INTO skill_prerequisites (skill_id, prerequisite_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [skillUuid, preUuid]
        );
      }
    }

    for (const ex of graph.exercises) {
      const realId = exerciseIdMap.get(ex.id)!;
      await client.query(
        `INSERT INTO exercises (id, name, description, notes, target_bpm, estimated_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [realId, ex.name, ex.description, ex.notes, ex.targetBpm, ex.estimatedMinutes]
      );
    }

    for (const ex of graph.exercises) {
      const exerciseUuid = exerciseIdMap.get(ex.id)!;
      for (const skillSeedId of ex.skillIds) {
        const skillUuid = skillIdMap.get(skillSeedId);
        if (!skillUuid) continue;
        await client.query(
          `INSERT INTO exercise_skills (exercise_id, skill_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [exerciseUuid, skillUuid]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Imported ${graph.skills.length} skills, ${graph.exercises.length} exercises`);
    return 0;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    console.error(err instanceof Error ? err.message : err);
    return 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
