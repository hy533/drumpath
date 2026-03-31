import { Router, NextFunction } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../middleware/auth';
import { planSession } from '../services/planner';
import type { ExerciseWithSkills, Skill } from '../types';

export function createPlanRouter(db: Pool): Router {
  const router = Router();

  router.post('/generate', requireAuth, async (req, res, next: NextFunction) => {
    const { targetMinutes, shuffle: shuffleRaw } = req.body as {
      targetMinutes?: unknown;
      shuffle?: unknown;
    };

    if (
      typeof targetMinutes !== 'number' ||
      !Number.isInteger(targetMinutes) ||
      targetMinutes <= 0
    ) {
      res.status(400).json({ error: 'targetMinutes must be a positive integer' });
      return;
    }

    if (shuffleRaw !== undefined && typeof shuffleRaw !== 'boolean') {
      res.status(400).json({ error: 'shuffle must be a boolean' });
      return;
    }
    const shuffle = shuffleRaw === true;

    try {
      const exercisesResult = await db.query<{
        id: string;
        name: string;
        description: string;
        notes: string;
        target_bpm: number | null;
        estimated_minutes: number;
        video_url: string | null;
        audio_url: string | null;
        skill_id: string | null;
        skill_name: string | null;
        category: string | null;
        level: string | null;
        has_bpm_target: boolean | null;
        skill_description: string | null;
      }>(`
        SELECT e.id, e.name, e.description, e.notes, e.target_bpm, e.estimated_minutes,
               e.video_url, e.audio_url,
               s.id AS skill_id, s.name AS skill_name, s.category, s.level, s.has_bpm_target, s.description AS skill_description
        FROM exercises e
        LEFT JOIN exercise_skills es ON es.exercise_id = e.id
        LEFT JOIN skills s ON s.id = es.skill_id
        ORDER BY e.id
      `);

      const exerciseMap = new Map<string, ExerciseWithSkills>();
      for (const row of exercisesResult.rows) {
        if (!exerciseMap.has(row.id)) {
          exerciseMap.set(row.id, {
            id: row.id,
            name: row.name,
            description: row.description,
            notes: row.notes,
            targetBpm: row.target_bpm,
            estimatedMinutes: row.estimated_minutes,
            skillIds: [],
            skills: [],
            videoUrl: row.video_url,
            audioUrl: row.audio_url,
          });
        }
        if (row.skill_id) {
          const ex = exerciseMap.get(row.id)!;
          ex.skillIds.push(row.skill_id);
          ex.skills.push({
            id: row.skill_id,
            name: row.skill_name!,
            category: row.category as Skill['category'],
            level: row.level as Skill['level'],
            hasBpmTarget: row.has_bpm_target!,
            description: row.skill_description ?? '',
          });
        }
      }

      const exercises = Array.from(exerciseMap.values());

      const masteryResult = await db.query<{ skill_id: string; score: number }>(
        `SELECT skill_id, score FROM user_mastery WHERE user_id = $1`,
        [req.userId!]
      );

      const masteryMap = new Map<string, number>();
      for (const row of masteryResult.rows) {
        masteryMap.set(row.skill_id, row.score);
      }

      const plan = planSession(exercises, masteryMap, targetMinutes, shuffle);
      res.status(200).json({ plan });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
