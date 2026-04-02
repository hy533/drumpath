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

const TEST_USER_ID = '60000000-0000-0000-0000-000000000001';
const TEST_SKILL_ID = '60000000-0000-0000-0000-000000000002';
const TEST_EXERCISE_ID = '60000000-0000-0000-0000-000000000003';

beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL_TEST });

  app = express();
  app.use(express.json());
  app.use('/plan', createPlanRouter(db));

  const secret = process.env.JWT_SECRET!;
  authToken = jwt.sign({ userId: TEST_USER_ID }, secret, { expiresIn: '1h' });

  await db.query(`
    INSERT INTO users (id, email, password_hash) VALUES
      ('${TEST_USER_ID}', 'plan-shuffle-test@drumpath-test.example', 'hash')
    ON CONFLICT DO NOTHING;

    INSERT INTO skills (id, name, category, level, has_bpm_target) VALUES
      ('${TEST_SKILL_ID}', 'Plan Shuffle Test Skill', 'Technique', 'Beginner', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO exercises (id, name, description, notes, target_bpm, estimated_minutes) VALUES
      ('${TEST_EXERCISE_ID}', 'Plan Shuffle Test Exercise', 'desc', 'notes', 100, 10)
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

describe('POST /plan/generate shuffle param', () => {
  it('accepts shuffle=true and returns a valid plan', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: 30, shuffle: true });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plan)).toBe(true);
  });

  it('accepts shuffle=false and returns a valid plan', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: 30, shuffle: false });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plan)).toBe(true);
  });

  it('omitting shuffle still returns a valid plan', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: 30 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plan)).toBe(true);
  });

  it('rejects invalid shuffle value with 400', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetMinutes: 30, shuffle: 'yes' });
    expect(res.status).toBe(400);
  });
});
