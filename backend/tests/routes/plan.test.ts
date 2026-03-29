import { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { createPlanRouter } from '../../src/routes/plan';

let db: Pool;
let app: express.Express;
let authToken: string;

const TEST_USER_ID = '50000000-0000-0000-0000-000000000001';
const TEST_SKILL_ID = '50000000-0000-0000-0000-000000000002';
const TEST_EXERCISE_ID = '50000000-0000-0000-0000-000000000003';

beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL_TEST });

  app = express();
  app.use(express.json());
  app.use('/plan', createPlanRouter(db));

  const secret = process.env.JWT_SECRET!;
  authToken = jwt.sign({ userId: TEST_USER_ID }, secret, { expiresIn: '1h' });

  await db.query(`
    INSERT INTO users (id, email, password_hash) VALUES
      ('${TEST_USER_ID}', 'plan-route-test@drumpath-test.example', 'hash')
    ON CONFLICT DO NOTHING;

    INSERT INTO skills (id, name, category, level, has_bpm_target) VALUES
      ('${TEST_SKILL_ID}', 'Plan Route Test Skill', 'Technique', 'Beginner', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO exercises (id, name, description, notes, target_bpm, estimated_minutes) VALUES
      ('${TEST_EXERCISE_ID}', 'Plan Route Test Exercise', 'desc', 'notes', 100, 10)
    ON CONFLICT DO NOTHING;

    INSERT INTO exercise_skills (exercise_id, skill_id) VALUES
      ('${TEST_EXERCISE_ID}', '${TEST_SKILL_ID}')
    ON CONFLICT DO NOTHING;
  `);
});

afterAll(async () => {
  await db.query(`
    DELETE FROM exercise_skills WHERE exercise_id = '${TEST_EXERCISE_ID}';
    DELETE FROM exercises WHERE id = '${TEST_EXERCISE_ID}';
    DELETE FROM skills WHERE id = '${TEST_SKILL_ID}';
    DELETE FROM users WHERE id = '${TEST_USER_ID}';
  `);
  await db.end();
});

describe('POST /plan/generate', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .send({ targetMinutes: 30 });
    expect(res.status).toBe(401);
  });

  it('returns 200 with { plan: [...] } array', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
    expect(Array.isArray(res.body.plan)).toBe(true);
  });

  it('plan items have expected shape with exercise and suggestedBpm', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: 30 });

    expect(res.status).toBe(200);
    expect(res.body.plan.length).toBeGreaterThan(0);

    const item = res.body.plan[0];
    expect(item).toHaveProperty('exercise');
    expect(item).toHaveProperty('suggestedBpm');
    expect(item.exercise).toHaveProperty('id');
    expect(item.exercise).toHaveProperty('name');
    expect(item.exercise).toHaveProperty('skills');
    expect(Array.isArray(item.exercise.skills)).toBe(true);
  });

  it('returns 400 for invalid targetMinutes (0 or negative)', async () => {
    const res1 = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: 0 });

    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: -10 });

    expect(res2.status).toBe(400);
  });
});
