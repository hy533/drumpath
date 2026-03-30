import { Router, NextFunction } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function createAuthRouter(db: Pool): Router {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');

  const router = Router();

  router.post('/register', async (req, res, next: NextFunction) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await db.query<{ id: string; onboarded: boolean }>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, onboarded`,
        [email, passwordHash]
      );

      const { id: userId, onboarded } = result.rows[0];
      const token = jwt.sign({ userId }, secret, { expiresIn: '7d' });

      res.status(201).json({ token, userId, onboarded });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
      next(err);
    }
  });

  router.post('/login', async (req, res, next: NextFunction) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    try {
      const result = await db.query<{ id: string; password_hash: string; onboarded: boolean }>(
        `SELECT id, password_hash, onboarded FROM users WHERE email = $1`,
        [email]
      );

      const user = result.rows[0];
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const userId = user.id;
      const token = jwt.sign({ userId }, secret, { expiresIn: '7d' });

      res.status(200).json({ token, userId, onboarded: user.onboarded });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
