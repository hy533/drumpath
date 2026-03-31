import request from 'supertest';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from '../../src/app';
import { db } from '../../src/db/client';

let app: express.Express;
let token: string;
const TEST_EXERCISE_ID = '77000000-0000-0000-0000-000000000001';

beforeAll(async () => {
  app = createApp(db);
  const res = await request(app)
    .post('/auth/register')
    .send({ email: 'media-test@example.com', password: 'password123' });
  token = res.body.token;

  await db.query(`
    INSERT INTO exercises (id, name, description, notes, target_bpm, estimated_minutes, video_url, audio_url)
    VALUES ($1, 'Media Test Exercise', 'test desc', 'test notes', null, 5,
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ', null)
    ON CONFLICT (id) DO UPDATE SET
      video_url = EXCLUDED.video_url,
      audio_url = EXCLUDED.audio_url
  `, [TEST_EXERCISE_ID]);
});

afterAll(async () => {
  await db.query(`DELETE FROM exercises WHERE id = $1`, [TEST_EXERCISE_ID]);
  await db.query(`DELETE FROM users WHERE email = 'media-test@example.com'`);
  await db.end();
});

describe('GET /exercises includes media URL fields', () => {
  it('returns videoUrl and audioUrl on every exercise', async () => {
    const res = await request(app)
      .get('/exercises')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    for (const ex of res.body.exercises) {
      expect('videoUrl' in ex).toBe(true);
      expect('audioUrl' in ex).toBe(true);
    }
  });

  it('returns the correct videoUrl for an exercise with a URL set', async () => {
    const res = await request(app)
      .get('/exercises')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ex = res.body.exercises.find((e: { id: string }) => e.id === TEST_EXERCISE_ID);
    expect(ex).toBeDefined();
    expect(ex.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(ex.audioUrl).toBeNull();
  });
});
