import express from 'express';
import type { Pool } from 'pg';
import { createAuthRouter } from './routes/auth';
import { createExercisesRouter } from './routes/exercises';
import { createPlanRouter } from './routes/plan';
import { createSessionsRouter } from './routes/sessions';
import { createSkillsRouter } from './routes/skills';
import { createConceptsRouter } from './routes/concepts';

export function createApp(db: Pool): express.Express {
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    const allowOrigin =
      process.env.NODE_ENV !== 'production'
        ? '*'
        : (process.env.CORS_ORIGIN ?? '*');
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter(db));
  app.use('/skills', createSkillsRouter(db));
  app.use('/exercises', createExercisesRouter(db));
  app.use('/sessions', createSessionsRouter(db));
  app.use('/plan', createPlanRouter(db));
  app.use('/concepts', createConceptsRouter());

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  );

  return app;
}
