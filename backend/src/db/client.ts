import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

export const db = new Pool({
  connectionString: isTest
    ? process.env.DATABASE_URL_TEST
    : process.env.DATABASE_URL
});
