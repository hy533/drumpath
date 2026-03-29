import { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { createSkillsRouter } from '../../src/routes/skills';

let db: Pool;
let app: express.Express;
let authToken: string;

const TEST_USER_ID = '00000000-0000-0000-0000-000000000002';
const SKILL_A_ID = '20000000-0000-0000-0000-000000000001'; // no prerequisites
const SKILL_B_ID = '20000000-0000-0000-0000-000000000002'; // requires SKILL_A
const SKILL_C_ID = '20000000-0000-0000-0000-000000000003'; // requires SKILL_B

beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL_TEST });

  app = express();
  app.use(express.json());
  app.use('/skills', createSkillsRouter(db));

  const secret = process.env.JWT_SECRET!;
  authToken = jwt.sign({ userId: TEST_USER_ID }, secret, { expiresIn: '1h' });

  await db.query(`
    INSERT INTO users (id, email, password_hash) VALUES
      ('${TEST_USER_ID}', 'skills-route-test@drumpath-test.example', 'hash')
    ON CONFLICT DO NOTHING;

    INSERT INTO skills (id, name, category, level, has_bpm_target) VALUES
      ('${SKILL_A_ID}', 'Skills Route Test A', 'Technique', 'Beginner', false),
      ('${SKILL_B_ID}', 'Skills Route Test B', 'Rudiment', 'Beginner', true),
      ('${SKILL_C_ID}', 'Skills Route Test C', 'Rudiment', 'Intermediate', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO skill_prerequisites (skill_id, prerequisite_id) VALUES
      ('${SKILL_B_ID}', '${SKILL_A_ID}'),
      ('${SKILL_C_ID}', '${SKILL_B_ID}')
    ON CONFLICT DO NOTHING;
  `);
});

afterAll(async () => {
  await db.query(`
    DELETE FROM user_mastery WHERE user_id = '${TEST_USER_ID}';
    DELETE FROM skill_prerequisites WHERE skill_id IN (
      '${SKILL_A_ID}', '${SKILL_B_ID}', '${SKILL_C_ID}'
    );
    DELETE FROM skills WHERE id IN (
      '${SKILL_A_ID}', '${SKILL_B_ID}', '${SKILL_C_ID}'
    );
    DELETE FROM users WHERE id = '${TEST_USER_ID}';
  `);
  await db.end();
});

describe('GET /skills', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app).get('/skills');
    expect(res.status).toBe(401);
  });

  it('returns 200 with skill graph including SkillWithMastery shape', async () => {
    const res = await request(app)
      .get('/skills')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('skills');
    expect(Array.isArray(res.body.skills)).toBe(true);

    const skill = res.body.skills.find((s: { id: string }) => s.id === SKILL_A_ID);
    expect(skill).toBeDefined();
    expect(skill).toHaveProperty('id');
    expect(skill).toHaveProperty('name');
    expect(skill).toHaveProperty('category');
    expect(skill).toHaveProperty('level');
    expect(skill).toHaveProperty('hasBpmTarget');
    expect(skill).toHaveProperty('masteryScore');
    expect(skill).toHaveProperty('qualifyingSessions');
    expect(skill).toHaveProperty('prerequisiteIds');
    expect(skill).toHaveProperty('lastPracticedAt');
  });
});

describe('GET /skills/available', () => {
  it('returns 200 with skills that have no un-mastered prerequisites', async () => {
    const res = await request(app)
      .get('/skills/available')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('skills');
    expect(Array.isArray(res.body.skills)).toBe(true);

    const ids = res.body.skills.map((s: { id: string }) => s.id);
    // SKILL_A has no prerequisites — should be available
    expect(ids).toContain(SKILL_A_ID);
    // SKILL_B requires SKILL_A which is not mastered — should not be available
    expect(ids).not.toContain(SKILL_B_ID);
  });
});

describe('POST /skills/onboard', () => {
  it('returns 200 with updated count matching ratings array length', async () => {
    const ratings = [
      { skillId: SKILL_A_ID, rating: 2 },
      { skillId: SKILL_B_ID, rating: 1 },
    ];

    const res = await request(app)
      .post('/skills/onboard')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ratings });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 2 });
  });

  it('returns 400 when ratings is missing', async () => {
    const res = await request(app)
      .post('/skills/onboard')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when ratings is not an array', async () => {
    const res = await request(app)
      .post('/skills/onboard')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ratings: 'not-an-array' });

    expect(res.status).toBe(400);
  });
});
