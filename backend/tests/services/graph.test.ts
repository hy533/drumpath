import { Pool } from 'pg';
import { getAvailableSkills, getSkillGraph } from '../../src/services/graph';
import dotenv from 'dotenv';
dotenv.config();

let db: Pool;

beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
  // Seed minimal test data
  await db.query(`
    INSERT INTO users (id, email, password_hash) VALUES
      ('00000000-0000-0000-0000-000000000001', 'test@test.com', 'hash')
    ON CONFLICT DO NOTHING;

    INSERT INTO skills (id, name, category, level, has_bpm_target) VALUES
      ('10000000-0000-0000-0000-000000000001', 'Grip', 'Technique', 'Beginner', false),
      ('10000000-0000-0000-0000-000000000002', 'Single Stroke', 'Rudiment', 'Beginner', true),
      ('10000000-0000-0000-0000-000000000003', 'Paradiddle', 'Rudiment', 'Intermediate', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO skill_prerequisites (skill_id, prerequisite_id) VALUES
      ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
      ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  `);
});

afterAll(async () => {
  await db.query(`
    DELETE FROM skill_prerequisites WHERE skill_id IN (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    );
    DELETE FROM skills WHERE id IN (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    );
    DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001';
  `);
  await db.end();
});

const userId = '00000000-0000-0000-0000-000000000001';
const gripId = '10000000-0000-0000-0000-000000000001';
const singleStrokeId = '10000000-0000-0000-0000-000000000002';

describe('getAvailableSkills', () => {
  it('returns skills with no prerequisites for a new user', async () => {
    const skills = await getAvailableSkills(userId, db);
    const ids = skills.map(s => s.id);
    expect(ids).toContain(gripId);
    expect(ids).not.toContain(singleStrokeId); // prerequisite not mastered
  });

  it('returns single stroke once grip is mastered', async () => {
    await db.query(`
      INSERT INTO user_mastery (user_id, skill_id, score, qualifying_sessions)
      VALUES ($1, $2, 100, 3)
      ON CONFLICT (user_id, skill_id) DO UPDATE SET score = 100, qualifying_sessions = 3
    `, [userId, gripId]);

    const skills = await getAvailableSkills(userId, db);
    const ids = skills.map(s => s.id);
    expect(ids).toContain(singleStrokeId);
    expect(ids).not.toContain(gripId); // already mastered
  });
});

describe('getSkillGraph', () => {
  it('returns all skills with mastery scores and prerequisite ids', async () => {
    const graph = await getSkillGraph(userId, db);
    const grip = graph.find(s => s.id === gripId)!;
    expect(grip.masteryScore).toBe(100);
    expect(grip.prerequisiteIds).toHaveLength(0);

    const single = graph.find(s => s.id === singleStrokeId)!;
    expect(single.prerequisiteIds).toContain(gripId);
  });
});
