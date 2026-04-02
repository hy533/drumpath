import type { Pool } from 'pg';
import type { Skill, SkillWithMastery } from '../types';

export async function getAvailableSkills(userId: string, db: Pool): Promise<Skill[]> {
  const result = await db.query<{
    id: string; name: string; category: string; level: string;
    has_bpm_target: boolean; description: string; concept_slug: string | null;
  }>(`
    SELECT s.id, s.name, s.category, s.level, s.has_bpm_target, s.description, s.concept_slug
    FROM skills s
    WHERE
      -- skill not yet mastered by this user
      NOT EXISTS (
        SELECT 1 FROM user_mastery um
        WHERE um.user_id = $1 AND um.skill_id = s.id AND um.score = 100
      )
      -- all prerequisites are mastered
      AND NOT EXISTS (
        SELECT 1 FROM skill_prerequisites sp
        LEFT JOIN user_mastery um
          ON um.skill_id = sp.prerequisite_id AND um.user_id = $1
        WHERE sp.skill_id = s.id
          AND (um.score IS NULL OR um.score < 100)
      )
  `, [userId]);

  return result.rows.map(rowToSkill);
}

export async function getSkillGraph(userId: string, db: Pool): Promise<SkillWithMastery[]> {
  const result = await db.query<{
    id: string; name: string; category: string; level: string;
    has_bpm_target: boolean; description: string; concept_slug: string | null;
    score: number | null; qualifying_sessions: number | null;
    last_practiced_at: Date | null;
    prerequisite_ids: string[] | null;
  }>(`
    SELECT
      s.id, s.name, s.category, s.level, s.has_bpm_target, s.description, s.concept_slug,
      um.score,
      um.qualifying_sessions,
      um.last_practiced_at,
      ARRAY_REMOVE(ARRAY_AGG(sp.prerequisite_id), NULL) AS prerequisite_ids
    FROM skills s
    LEFT JOIN user_mastery um ON um.skill_id = s.id AND um.user_id = $1
    LEFT JOIN skill_prerequisites sp ON sp.skill_id = s.id
    GROUP BY s.id, s.name, s.category, s.level, s.has_bpm_target, s.description, s.concept_slug,
             um.score, um.qualifying_sessions, um.last_practiced_at
  `, [userId]);

  return result.rows.map(row => ({
    ...rowToSkill(row),
    masteryScore: row.score ?? 0,
    qualifyingSessions: row.qualifying_sessions ?? 0,
    prerequisiteIds: row.prerequisite_ids ?? [],
    lastPracticedAt: row.last_practiced_at ?? null
  }));
}

function rowToSkill(row: {
  id: string; name: string; category: string; level: string;
  has_bpm_target: boolean; description: string; concept_slug: string | null;
}): Skill {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Skill['category'],
    level: row.level as Skill['level'],
    hasBpmTarget: row.has_bpm_target,
    description: row.description,
    conceptSlug: row.concept_slug,
  };
}
