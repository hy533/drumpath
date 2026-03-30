import { Router, NextFunction } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../middleware/auth';
import { getSkillGraph, getAvailableSkills } from '../services/graph';
import { onboardingRatingToScore } from '../services/mastery';

export function createSkillsRouter(db: Pool): Router {
  const router = Router();

  router.get('/', requireAuth, async (req, res, next: NextFunction) => {
    try {
      const skills = await getSkillGraph(req.userId!, db);
      res.status(200).json({ skills });
    } catch (err) {
      next(err);
    }
  });

  router.get('/available', requireAuth, async (req, res, next: NextFunction) => {
    try {
      const skills = await getAvailableSkills(req.userId!, db);
      res.status(200).json({ skills });
    } catch (err) {
      next(err);
    }
  });

  router.post('/onboard', requireAuth, async (req, res, next: NextFunction) => {
    const { ratings } = req.body as { ratings?: unknown };

    if (!ratings || !Array.isArray(ratings)) {
      res.status(400).json({ error: 'ratings must be an array' });
      return;
    }

    for (const item of ratings) {
      const skillId =
        typeof item === 'object' && item !== null && 'skillId' in item
          ? (item as { skillId: unknown }).skillId
          : undefined;
      const rating =
        typeof item === 'object' && item !== null && 'rating' in item
          ? (item as { rating: unknown }).rating
          : undefined;

      if (
        typeof skillId !== 'string' ||
        skillId.length === 0 ||
        (rating !== 1 && rating !== 2 && rating !== 3)
      ) {
        res.status(400).json({ error: 'Invalid ratings format' });
        return;
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const { skillId, rating } of ratings as Array<{ skillId: string; rating: 1 | 2 | 3 }>) {
        const score = onboardingRatingToScore(rating);
        await client.query(
          `INSERT INTO user_mastery (user_id, skill_id, score, qualifying_sessions)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (user_id, skill_id) DO UPDATE SET score = EXCLUDED.score`,
          [req.userId!, skillId, score]
        );
      }
      await client.query(
        `UPDATE users SET onboarded = true WHERE id = $1`,
        [req.userId]
      );
      await client.query('COMMIT');
      res.status(200).json({ updated: ratings.length });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  });

  return router;
}
