import { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { createExercisesRouter } from '../../src/routes/exercises';

let db: Pool;
let app: express.Express;
let authToken: string;

const TEST_USER_ID = '00000000-0000-0000-0000-000000000003';
const TEST_SKILL_ID = '20000000-0000-0000-0000-000000000004';
const EXERCISE_WITH_SKILL_ID = '30000000-0000-0000-0000-000000000001';
const EXERCISE_NO_SKILL_ID = '30000000-0000-0000-0000-000000000002';

beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL_TEST });

  app = express();
  app.use(express.json());
  app.use('/exercises', createExercisesRouter(db));

  const secret = process.env.JWT_SECRET!;
  authToken = jwt.sign({ userId: TEST_USER_ID }, secret, { expiresIn: '1h' });

  await db.query(`
    INSERT INTO users (id, email, password_hash) VALUES
      ('${TEST_USER_ID}', 'exercises-route-test@drumpath-test.example', 'hash')
    ON CONFLICT DO NOTHING;

    INSERT INTO skills (id, name, category, level, has_bpm_target) VALUES
      ('${TEST_SKILL_ID}', 'Exercises Route Test Skill', 'Technique', 'Beginner', false)
    ON CONFLICT DO NOTHING;

    INSERT INTO exercises (id, name, description, notes, target_bpm, estimated_minutes) VALUES
      ('${EXERCISE_WITH_SKILL_ID}', 'Exercise With Skill', 'desc1', 'notes1', 80, 10),
      ('${EXERCISE_NO_SKILL_ID}', 'Exercise No Skill', 'desc2', 'notes2', NULL, 5)
    ON CONFLICT DO NOTHING;

    INSERT INTO exercise_skills (exercise_id, skill_id) VALUES
      ('${EXERCISE_WITH_SKILL_ID}', '${TEST_SKILL_ID}')
    ON CONFLICT DO NOTHING;
  `);
});

afterAll(async () => {
  await db.query(`
    DELETE FROM exercise_skills WHERE exercise_id IN (
      '${EXERCISE_WITH_SKILL_ID}', '${EXERCISE_NO_SKILL_ID}'
    );
    DELETE FROM exercises WHERE id IN (
      '${EXERCISE_WITH_SKILL_ID}', '${EXERCISE_NO_SKILL_ID}'
    );
    DELETE FROM skills WHERE id = '${TEST_SKILL_ID}';
    DELETE FROM users WHERE id = '${TEST_USER_ID}';
  `);
  await db.end();
});

describe('GET /exercises', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app).get('/exercises');
    expect(res.status).toBe(401);
  });

  it('returns 200 with exercises array of correct shape', async () => {
    const res = await request(app)
      .get('/exercises')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('exercises');
    expect(Array.isArray(res.body.exercises)).toBe(true);

    const ex = res.body.exercises.find((e: { id: string }) => e.id === EXERCISE_WITH_SKILL_ID);
    expect(ex).toBeDefined();
    expect(ex).toHaveProperty('id');
    expect(ex).toHaveProperty('name');
    expect(ex).toHaveProperty('description');
    expect(ex).toHaveProperty('notes');
    expect(ex).toHaveProperty('targetBpm');
    expect(ex).toHaveProperty('estimatedMinutes');
    expect(ex).toHaveProperty('skillIds');
  });

  it('includes skillId for an exercise linked to a skill', async () => {
    const res = await request(app)
      .get('/exercises')
      .set('Authorization', `Bearer ${authToken}`);

    const ex = res.body.exercises.find((e: { id: string }) => e.id === EXERCISE_WITH_SKILL_ID);
    expect(ex.skillIds).toContain(TEST_SKILL_ID);
  });

  it('returns empty skillIds for an exercise with no linked skills', async () => {
    const res = await request(app)
      .get('/exercises')
      .set('Authorization', `Bearer ${authToken}`);

    const ex = res.body.exercises.find((e: { id: string }) => e.id === EXERCISE_NO_SKILL_ID);
    expect(ex).toBeDefined();
    expect(ex.skillIds).toEqual([]);
  });
});
