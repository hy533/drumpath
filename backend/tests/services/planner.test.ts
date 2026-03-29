import { planSession } from '../../src/services/planner';
import type { ExerciseWithSkills } from '../../src/types';

const skill = (id: string, name = 'Skill'): import('../../src/types').Skill => ({
  id, name, category: 'Technique', description: '', level: 'Beginner', hasBpmTarget: false,
});

const exercise = (
  id: string,
  estimatedMinutes: number,
  skillIds: string[],
  targetBpm: number | null = null,
): ExerciseWithSkills => ({
  id, name: `Exercise ${id}`, description: '', notes: '',
  targetBpm, estimatedMinutes, skillIds,
  skills: skillIds.map(sid => skill(sid)),
});

describe('planSession', () => {
  it('returns empty array when no exercises provided', () => {
    const result = planSession([], new Map(), 30);
    expect(result).toEqual([]);
  });

  it('fills time greedily without exceeding targetMinutes', () => {
    const exercises = [
      exercise('e1', 10, ['s1']),
      exercise('e2', 10, ['s1']),
      exercise('e3', 10, ['s1']),
      exercise('e4', 10, ['s1']),
    ];
    const mastery = new Map([['s1', 50]]);
    const result = planSession(exercises, mastery, 25);
    // Should pick 2 exercises (20 min), not 3 (30 min would exceed 25)
    expect(result).toHaveLength(2);
    const totalMinutes = result.reduce((sum: number, pe) => sum + pe.exercise.estimatedMinutes, 0);
    expect(totalMinutes).toBeLessThanOrEqual(25);
  });

  it('prioritizes lower-mastery skills first', () => {
    const exercises = [
      exercise('e_high', 5, ['s_high']),
      exercise('e_low', 5, ['s_low']),
    ];
    const mastery = new Map([
      ['s_high', 90],
      ['s_low', 10],
    ]);
    // Only 5 minutes — should pick the low-mastery exercise
    const result = planSession(exercises, mastery, 5);
    expect(result).toHaveLength(1);
    expect(result[0].exercise.id).toBe('e_low');
  });

  it('calculates suggestedBpm correctly — scales with mastery', () => {
    const ex = exercise('e1', 10, ['s1'], 100);
    const masteryMap = new Map([['s1', 50]]);
    const result = planSession([ex], masteryMap, 10);
    expect(result).toHaveLength(1);
    // avgMastery = 50, formula: max(40, round(100 * (0.6 + 0.4 * 50/100))) = round(100 * 0.8) = 80
    expect(result[0].suggestedBpm).toBe(80);
  });

  it('scales suggestedBpm to 100% at full mastery', () => {
    const ex = exercise('e1', 5, ['s1'], 120);
    const masteryMap = new Map([['s1', 100]]);
    const result = planSession([ex], masteryMap, 5);
    // avgMastery = 100, formula: max(40, round(120 * (0.6 + 0.4 * 1.0))) = round(120 * 1.0) = 120
    expect(result[0].suggestedBpm).toBe(120);
  });

  it('scales suggestedBpm at 0 mastery to 60% of target (min 40)', () => {
    const ex = exercise('e1', 5, ['s1'], 100);
    const masteryMap = new Map([['s1', 0]]);
    const result = planSession([ex], masteryMap, 5);
    // avgMastery = 0, formula: max(40, round(100 * 0.6)) = 60
    expect(result[0].suggestedBpm).toBe(60);
  });

  it('clamps suggestedBpm to minimum of 40', () => {
    const ex = exercise('e1', 5, ['s1'], 50);
    const masteryMap = new Map([['s1', 0]]);
    const result = planSession([ex], masteryMap, 5);
    // formula: max(40, round(50 * 0.6)) = max(40, 30) = 40
    expect(result[0].suggestedBpm).toBe(40);
  });

  it('returns null suggestedBpm for exercise with no targetBpm', () => {
    const ex = exercise('e1', 5, ['s1'], null);
    const masteryMap = new Map([['s1', 50]]);
    const result = planSession([ex], masteryMap, 5);
    expect(result[0].suggestedBpm).toBeNull();
  });

  it('defaults priority to 50 for exercise with no skills', () => {
    const exNoSkills: ExerciseWithSkills = {
      id: 'e_no_skills', name: 'Ear Training', description: '', notes: '',
      targetBpm: null, estimatedMinutes: 5, skillIds: [], skills: [],
    };
    const exLowMastery = exercise('e_low', 5, ['s1']);
    const masteryMap = new Map([['s1', 10]]);
    // e_low has priority 10, e_no_skills has default priority 50 → e_low should come first
    const result = planSession([exNoSkills, exLowMastery], masteryMap, 5);
    expect(result).toHaveLength(1);
    expect(result[0].exercise.id).toBe('e_low');
  });

  it('includes exercise with no skills when it fits and lower-priority items are exhausted', () => {
    const exNoSkills: ExerciseWithSkills = {
      id: 'e_no_skills', name: 'Ear Training', description: '', notes: '',
      targetBpm: null, estimatedMinutes: 5, skillIds: [], skills: [],
    };
    // Only one exercise available, enough time — should still include it
    const result = planSession([exNoSkills], new Map(), 10);
    expect(result).toHaveLength(1);
    expect(result[0].exercise.id).toBe('e_no_skills');
  });
});
