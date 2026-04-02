import request from 'supertest';
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from '../../src/app';
import { db } from '../../src/db/client';

const app = createApp(db);
let token: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/register')
    .send({ email: 'skill-concept-test@example.com', password: 'password123' });
  token = res.body.token;
});

afterAll(async () => {
  await db.query(`DELETE FROM users WHERE email = 'skill-concept-test@example.com'`);
  await db.end();
});

describe('GET /skills includes conceptSlug', () => {
  it('returns conceptSlug field on every skill', async () => {
    const res = await request(app)
      .get('/skills')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    for (const skill of res.body.skills) {
      expect('conceptSlug' in skill).toBe(true);
    }
  });
});
