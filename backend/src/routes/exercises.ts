import { Router, NextFunction } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../middleware/auth';
import type { Exercise } from '../types';

export function createExercisesRouter(db: Pool): Router {
  const router = Router();

  router.get('/', requireAuth, async (req, res, next: NextFunction) => {
    try {
      const result = await db.query<{
        id: string;
        name: string;
        description: string;
        notes: string;
        target_bpm: number | null;
        estimated_minutes: number;
        skill_ids: string[];
      }>(`
        SELECT e.id, e.name, e.description, e.notes, e.target_bpm, e.estimated_minutes,
               ARRAY_REMOVE(ARRAY_AGG(es.skill_id), NULL) AS skill_ids
        FROM exercises e
        LEFT JOIN exercise_skills es ON es.exercise_id = e.id
        GROUP BY e.id
        ORDER BY e.name
      `);

      const exercises: Exercise[] = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        notes: row.notes,
        targetBpm: row.target_bpm,
        estimatedMinutes: row.estimated_minutes,
        skillIds: row.skill_ids ?? [],
      }));

      res.status(200).json({ exercises });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
