import { Pool } from 'pg';

const isTest = process.env.NODE_ENV === 'test';
const connectionString = isTest
  ? process.env.DATABASE_URL_TEST
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    `Missing env var: ${isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL'}`
  );
}

export const db = new Pool({ connectionString });
