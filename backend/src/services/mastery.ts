import type { UserMastery, Exercise, Feeling } from '../types';

export function calculateMasteryUpdate(
  current: UserMastery,
  exercise: Exercise,
  bpmReached: number | null,
  feeling: Feeling
): Pick<UserMastery, 'score' | 'qualifyingSessions'> {
  const goodFeeling = feeling === 'Good' || feeling === 'Nailed it';
  const bpmMet = exercise.targetBpm === null
    ? true
    : bpmReached !== null && bpmReached >= exercise.targetBpm;

  if (!goodFeeling || !bpmMet) {
    return { score: current.score, qualifyingSessions: current.qualifyingSessions };
  }

  const newQualifying = current.qualifyingSessions + 1;

  if (newQualifying >= 3) {
    return { score: 100, qualifyingSessions: newQualifying };
  } else if (newQualifying === 2) {
    return { score: 66, qualifyingSessions: newQualifying };
  } else {
    return { score: 33, qualifyingSessions: newQualifying };
  }
}

export function onboardingRatingToScore(rating: 1 | 2 | 3): number {
  if (rating === 1) return 0;
  if (rating === 2) return 34;
  return 67;
}
