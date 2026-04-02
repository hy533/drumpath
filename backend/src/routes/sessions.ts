import { Router, NextFunction } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../middleware/auth';
import { calculateMasteryUpdate } from '../services/mastery';
import type { Exercise, Feeling, UserMastery } from '../types';

const VALID_FEELINGS: Feeling[] = ['Rough', 'OK', 'Good', 'Nailed it'];

export function createSessionsRouter(db: Pool): Router {
  const router = Router();

  router.post('/', requireAuth, async (req, res, next: NextFunction) => {
    try {
      const result = await db.query<{ id: string }>(
        `INSERT INTO practice_sessions (user_id, started_at) VALUES ($1, NOW()) RETURNING id`,
        [req.userId!]
      );
      res.status(201).json({ sessionId: result.rows[0].id });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:sessionId/exercises', requireAuth, async (req, res, next: NextFunction) => {
    const { sessionId } = req.params;
    const { exerciseId, bpmReached, feeling, minutesSpent } = req.body as {
      exerciseId?: unknown;
      bpmReached?: unknown;
      feeling?: unknown;
      minutesSpent?: unknown;
    };

    if (typeof exerciseId !== 'string' || exerciseId.length === 0) {
      res.status(400).json({ error: 'exerciseId must be a non-empty string' });
      return;
    }
    if (!VALID_FEELINGS.includes(feeling as Feeling)) {
      res.status(400).json({ error: `feeling must be one of: ${VALID_FEELINGS.join(', ')}` });
      return;
    }
    if (typeof minutesSpent !== 'number' || !Number.isInteger(minutesSpent) || minutesSpent <= 0) {
      res.status(400).json({ error: 'minutesSpent must be a positive integer' });
      return;
    }

    let resolvedBpm: number | null;
    if (bpmReached === null || bpmReached === undefined) {
      resolvedBpm = null;
    } else if (typeof bpmReached === 'number' && Number.isInteger(bpmReached) && bpmReached >= 0) {
      resolvedBpm = bpmReached;
    } else {
      res.status(400).json({ error: 'bpmReached must be a non-negative integer or null' });
      return;
    }

    const client = await db.connect();
    let committed = false;
    try {
      await client.query('BEGIN');

      const owns = await client.query(
        'SELECT 1 FROM practice_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.userId!]
      );
      if (owns.rowCount === 0) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      await client.query(
        `INSERT INTO session_exercises (session_id, exercise_id, bpm_reached, feeling, minutes_spent)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, exerciseId, resolvedBpm, feeling, minutesSpent]
      );

      const exerciseResult = await client.query<{
        id: string;
        name: string;
        description: string;
        notes: string;
        target_bpm: number | null;
        estimated_minutes: number;
        video_url: string | null;
        audio_url: string | null;
        skill_ids: string[];
      }>(
        `SELECT e.id, e.name, e.description, e.notes, e.target_bpm, e.estimated_minutes,
                e.video_url, e.audio_url,
                ARRAY_REMOVE(ARRAY_AGG(es.skill_id), NULL) AS skill_ids
         FROM exercises e
         LEFT JOIN exercise_skills es ON es.exercise_id = e.id
         WHERE e.id = $1
         GROUP BY e.id`,
        [exerciseId]
      );

      if (exerciseResult.rows.length > 0) {
        const exRow = exerciseResult.rows[0];
        const exercise: Exercise = {
          id: exRow.id,
          name: exRow.name,
          description: exRow.description,
          notes: exRow.notes,
          targetBpm: exRow.target_bpm,
          estimatedMinutes: exRow.estimated_minutes,
          skillIds: exRow.skill_ids ?? [],
          videoUrl: exRow.video_url,
          audioUrl: exRow.audio_url,
        };

        for (const skillId of exercise.skillIds) {
          const masteryResult = await client.query<{
            score: number;
            qualifying_sessions: number;
            last_practiced_at: Date | null;
          }>(
            `SELECT score, qualifying_sessions, last_practiced_at
             FROM user_mastery
             WHERE user_id = $1 AND skill_id = $2`,
            [req.userId!, skillId]
          );

          const currentMastery: UserMastery = masteryResult.rows.length > 0
            ? {
                userId: req.userId!,
                skillId,
                score: masteryResult.rows[0].score,
                qualifyingSessions: masteryResult.rows[0].qualifying_sessions,
                lastPracticedAt: masteryResult.rows[0].last_practiced_at,
              }
            : {
                userId: req.userId!,
                skillId,
                score: 0,
                qualifyingSessions: 0,
                lastPracticedAt: null,
              };

          const update = calculateMasteryUpdate(
            currentMastery,
            exercise,
            resolvedBpm,
            feeling as Feeling
          );

          await client.query(
            `INSERT INTO user_mastery (user_id, skill_id, score, qualifying_sessions, last_practiced_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, skill_id) DO UPDATE
             SET score = EXCLUDED.score,
                 qualifying_sessions = EXCLUDED.qualifying_sessions,
                 last_practiced_at = EXCLUDED.last_practiced_at`,
            [req.userId!, skillId, update.score, update.qualifyingSessions]
          );
        }
      }

      await client.query('COMMIT');
      committed = true;
      res.status(201).json({ logged: true });
    } catch (err) {
      if (!committed) await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  });

  router.post('/:sessionId/end', requireAuth, async (req, res, next: NextFunction) => {
    const { sessionId } = req.params;

    try {
      const result = await db.query<{ total_minutes: number }>(
        `UPDATE practice_sessions
         SET ended_at = NOW(),
             total_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60)::INTEGER
         WHERE id = $1 AND user_id = $2
         RETURNING total_minutes`,
        [sessionId, req.userId!]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.status(200).json({ totalMinutes: result.rows[0].total_minutes });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
