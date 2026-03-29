import { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { createAuthRouter } from '../../src/routes/auth';
import { requireAuth } from '../../src/middleware/auth';

const TEST_EMAIL_SUFFIX = '@drumpath-test.example';

let db: Pool;
let app: express.Express;

beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL_TEST });

  app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(db));

  // Protected route for testing requireAuth middleware
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ userId: req.userId });
  });
});

afterAll(async () => {
  await db.query(`DELETE FROM users WHERE email LIKE $1`, [`%${TEST_EMAIL_SUFFIX}`]);
  await db.end();
});

describe('POST /auth/register', () => {
  it('returns 201 with token and userId for valid data', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: `register-ok${TEST_EMAIL_SUFFIX}`, password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.userId).toBe('string');
  });

  it('returns 409 for duplicate email', async () => {
    const email = `register-dup${TEST_EMAIL_SUFFIX}`;
    await request(app).post('/auth/register').send({ email, password: 'secret123' });

    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'differentpass' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered' });
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: `register-nopass${TEST_EMAIL_SUFFIX}` });

    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: 'secret123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  const loginEmail = `login-ok${TEST_EMAIL_SUFFIX}`;
  const loginPassword = 'loginpass456';

  beforeAll(async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: loginEmail, password: loginPassword });
  });

  it('returns 200 with token and userId for correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: loginEmail, password: loginPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: loginEmail, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: `nobody${TEST_EMAIL_SUFFIX}`, password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: 'secret123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: loginEmail });

    expect(res.status).toBe(400);
  });
});

describe('requireAuth middleware', () => {
  const secret = process.env.JWT_SECRET!;

  it('allows requests with a valid JWT and attaches userId', async () => {
    const userId = 'test-user-id';
    const token = jwt.sign({ userId }, secret, { expiresIn: '7d' });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer this.is.notvalid');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 for an expired token', async () => {
    const token = jwt.sign({ userId: 'u1' }, secret, { expiresIn: -1 });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});
