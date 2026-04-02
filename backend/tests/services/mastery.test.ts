import { calculateMasteryUpdate } from '../../src/services/mastery';
import type { UserMastery, Exercise, Feeling } from '../../src/types';

const baseMastery: UserMastery = {
  userId: 'u1',
  skillId: 's1',
  score: 0,
  qualifyingSessions: 0,
  lastPracticedAt: null
};

const bpmExercise: Exercise = {
  id: 'e1', name: 'Single Stroke Roll', description: '', notes: '',
  targetBpm: 100, estimatedMinutes: 10, skillIds: ['s1'],
  videoUrl: null, audioUrl: null,
};

const nonBpmExercise: Exercise = {
  id: 'e2', name: 'Grip & Posture', description: '', notes: '',
  targetBpm: null, estimatedMinutes: 5, skillIds: ['s1'],
  videoUrl: null, audioUrl: null,
};

describe('calculateMasteryUpdate', () => {
  it('returns score 33 after first qualifying BPM session', () => {
    const result = calculateMasteryUpdate(baseMastery, bpmExercise, 100, 'Good');
    expect(result.score).toBe(33);
    expect(result.qualifyingSessions).toBe(1);
  });

  it('returns score 66 after second qualifying BPM session', () => {
    const after1 = { ...baseMastery, score: 33, qualifyingSessions: 1 };
    const result = calculateMasteryUpdate(after1, bpmExercise, 100, 'Good');
    expect(result.score).toBe(66);
    expect(result.qualifyingSessions).toBe(2);
  });

  it('returns score 100 after third qualifying session', () => {
    const after2 = { ...baseMastery, score: 66, qualifyingSessions: 2 };
    const result = calculateMasteryUpdate(after2, bpmExercise, 100, 'Nailed it');
    expect(result.score).toBe(100);
    expect(result.qualifyingSessions).toBe(3);
  });

  it('does not qualify when BPM is below target', () => {
    const result = calculateMasteryUpdate(baseMastery, bpmExercise, 80, 'Good');
    expect(result.score).toBe(0);
    expect(result.qualifyingSessions).toBe(0);
  });

  it('does not qualify when feeling is Rough or OK', () => {
    const roughResult = calculateMasteryUpdate(baseMastery, bpmExercise, 100, 'Rough');
    expect(roughResult.score).toBe(0);
    const okResult = calculateMasteryUpdate(baseMastery, bpmExercise, 100, 'OK');
    expect(okResult.score).toBe(0);
  });

  it('qualifies non-BPM exercise on Good/Nailed it without BPM check', () => {
    const result = calculateMasteryUpdate(baseMastery, nonBpmExercise, null, 'Good');
    expect(result.score).toBe(33);
    expect(result.qualifyingSessions).toBe(1);
  });

  it('does not reduce score — score only moves up', () => {
    const high = { ...baseMastery, score: 66, qualifyingSessions: 2 };
    const result = calculateMasteryUpdate(high, bpmExercise, 50, 'Rough');
    expect(result.score).toBe(66);
  });
});
