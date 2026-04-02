import dotenv from 'dotenv';
dotenv.config();

import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/db/client';

const app = createApp(db);
let token: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/register')
    .send({ email: 'concepts-route-test@example.com', password: 'password123' });
  token = res.body.token;
});

afterAll(async () => {
  await db.query(`DELETE FROM users WHERE email = 'concepts-route-test@example.com'`);
  await db.end();
});

describe('GET /concepts/:slug', () => {
  it('returns 200 with string content for existing slug', async () => {
    const res = await request(app)
      .get('/concepts/matched-grip')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.content).toBe('string');
    expect(res.body.content.length).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent slug', async () => {
    const res = await request(app)
      .get('/concepts/no-such-concept-xyz')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for slug with invalid characters', async () => {
    const res = await request(app)
      .get('/concepts/inv@lid!')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/concepts/matched-grip');
    expect(res.status).toBe(401);
  });
});
