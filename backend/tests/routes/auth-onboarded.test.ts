import request from 'supertest';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from '../../src/app';
import { db } from '../../src/db/client';

const TEST_SKILL_ID = 'a0000000-0000-0000-0000-000000000099';

let builtApp: express.Express;

beforeAll(() => {
  builtApp = createApp(db);
});

afterAll(async () => {
  await db.query(`DELETE FROM users WHERE email = 'onboard-test@example.com'`);
  await db.end();
});

describe('auth onboarded field', () => {
  it('register returns onboarded: false', async () => {
    const res = await request(builtApp)
      .post('/auth/register')
      .send({ email: 'onboard-test@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.onboarded).toBe(false);
    expect(typeof res.body.token).toBe('string');
  });

  it('login returns onboarded: false for fresh user', async () => {
    const res = await request(builtApp)
      .post('/auth/login')
      .send({ email: 'onboard-test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.onboarded).toBe(false);
  });
});

describe('POST /skills/onboard sets onboarded=true', () => {
  let token: string;

  beforeAll(async () => {
    await db.query(
      `INSERT INTO skills (id, name, category, level, has_bpm_target)
       VALUES ($1, 'Onboard Test Skill', 'Technique', 'Beginner', false)
       ON CONFLICT DO NOTHING`,
      [TEST_SKILL_ID]
    );

    const res = await request(builtApp)
      .post('/auth/register')
      .send({ email: 'onboard-set@example.com', password: 'password123' });
    token = res.body.token;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE email = 'onboard-set@example.com'`);
    await db.query(`DELETE FROM skills WHERE id = $1`, [TEST_SKILL_ID]);
  });

  it('login returns onboarded:true after calling /skills/onboard', async () => {
    const skillsRes = await request(builtApp)
      .get('/skills/available')
      .set('Authorization', `Bearer ${token}`);
    expect(skillsRes.status).toBe(200);

    const ratings = skillsRes.body.skills.map((s: { id: string }) => ({
      skillId: s.id,
      rating: 2,
    }));

    expect(ratings.length).toBeGreaterThan(0); // skills must be seeded for this test to work
    const onboardRes = await request(builtApp)
      .post('/skills/onboard')
      .set('Authorization', `Bearer ${token}`)
      .send({ ratings });
    expect(onboardRes.status).toBe(200);

    const loginRes = await request(builtApp)
      .post('/auth/login')
      .send({ email: 'onboard-set@example.com', password: 'password123' });
    expect(loginRes.body.onboarded).toBe(true);
  });
});
