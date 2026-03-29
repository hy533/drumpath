import { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { createSessionsRouter } from '../../src/routes/sessions';

let db: Pool;
let app: express.Express;
let authToken: string;

const TEST_USER_ID = '40000000-0000-0000-0000-000000000001';
const TEST_SKILL_ID = '40000000-0000-0000-0000-000000000002';
const TEST_EXERCISE_ID = '40000000-0000-0000-0000-000000000003';

beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL_TEST });

  app = express();
  app.use(express.json());
  app.use('/sessions', createSessionsRouter(db));

  const secret = process.env.JWT_SECRET!;
  authToken = jwt.sign({ userId: TEST_USER_ID }, secret, { expiresIn: '1h' });

  await db.query(`
    INSERT INTO users (id, email, password_hash) VALUES
      ('${TEST_USER_ID}', 'sessions-route-test@drumpath-test.example', 'hash')
    ON CONFLICT DO NOTHING;

    INSERT INTO skills (id, name, category, level, has_bpm_target) VALUES
      ('${TEST_SKILL_ID}', 'Sessions Route Test Skill', 'Technique', 'Beginner', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO exercises (id, name, description, notes, target_bpm, estimated_minutes) VALUES
      ('${TEST_EXERCISE_ID}', 'Sessions Route Test Exercise', 'desc', 'notes', 100, 10)
    ON CONFLICT DO NOTHING;

    INSERT INTO exercise_skills (exercise_id, skill_id) VALUES
      ('${TEST_EXERCISE_ID}', '${TEST_SKILL_ID}')
    ON CONFLICT DO NOTHING;
  `);
});

afterAll(async () => {
  await db.query(`
    DELETE FROM session_exercises WHERE session_id IN (
      SELECT id FROM practice_sessions WHERE user_id = '${TEST_USER_ID}'
    );
    DELETE FROM practice_sessions WHERE user_id = '${TEST_USER_ID}';
    DELETE FROM user_mastery WHERE user_id = '${TEST_USER_ID}';
    DELETE FROM exercise_skills WHERE exercise_id = '${TEST_EXERCISE_ID}';
    DELETE FROM exercises WHERE id = '${TEST_EXERCISE_ID}';
    DELETE FROM skills WHERE id = '${TEST_SKILL_ID}';
    DELETE FROM users WHERE id = '${TEST_USER_ID}';
  `);
  await db.end();
});

describe('POST /sessions', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app).post('/sessions');
    expect(res.status).toBe(401);
  });

  it('returns 201 with sessionId (UUID string)', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(typeof res.body.sessionId).toBe('string');
    expect(res.body.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('POST /sessions/:sessionId/exercises', () => {
  let sessionId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${authToken}`);
    sessionId = res.body.sessionId;
  });

  it('returns 201 with { logged: true } for valid body', async () => {
    const res = await request(app)
      .post(`/sessions/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        exerciseId: TEST_EXERCISE_ID,
        bpmReached: 90,
        feeling: 'Good',
        minutesSpent: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ logged: true });
  });

  it('returns 400 for invalid feeling', async () => {
    const res = await request(app)
      .post(`/sessions/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        exerciseId: TEST_EXERCISE_ID,
        bpmReached: 90,
        feeling: 'Amazing',
        minutesSpent: 5,
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when exerciseId is missing', async () => {
    const res = await request(app)
      .post(`/sessions/${sessionId}/exercises`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        bpmReached: 90,
        feeling: 'Good',
        minutesSpent: 5,
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /sessions/:sessionId/end', () => {
  let sessionId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${authToken}`);
    sessionId = res.body.sessionId;
  });

  it('returns 200 with { totalMinutes: number }', async () => {
    const res = await request(app)
      .post(`/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalMinutes');
    expect(typeof res.body.totalMinutes).toBe('number');
  });
});
