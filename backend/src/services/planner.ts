import type { ExerciseWithSkills, PlannedExercise } from '../types';

/**
 * Generates a time-bounded, prioritised practice plan.
 *
 * @param exercises - candidate exercises to include.
 * @param masteryMap - skillId → mastery score (0–100).
 *   Skills absent from the map are treated as 0% mastery (= highest priority).
 * @param targetMinutes - target session length; the returned plan will not
 *   exceed this duration. A value ≤ 0 always returns an empty plan.
 * @param shuffle - when true, adds random jitter (0–50 mastery points) to each
 *   exercise's priority score, producing a different order each call while still
 *   biasing toward lower-mastery exercises on average.
 */
export function planSession(
  exercises: ExerciseWithSkills[],
  masteryMap: Map<string, number>,
  targetMinutes: number,
  shuffle = false,
): PlannedExercise[] {
  if (targetMinutes <= 0) return [];

  const prioritized = exercises
    .map(ex => {
      const avgMastery = ex.skills.length === 0
        ? 50
        : ex.skills.reduce((sum, s) => sum + (masteryMap.get(s.id) ?? 0), 0) / ex.skills.length;
      const jitter = shuffle ? Math.random() * 50 : 0;
      return { ex, avgMastery, score: avgMastery + jitter };
    })
    .sort((a, b) => a.score - b.score);

  const plan: PlannedExercise[] = [];
  let minutesUsed = 0;

  for (const { ex, avgMastery } of prioritized) {
    if (minutesUsed + ex.estimatedMinutes > targetMinutes) continue;

    const suggestedBpm = ex.targetBpm === null
      ? null
      : Math.max(40, Math.round(ex.targetBpm * (0.6 + 0.4 * avgMastery / 100)));

    plan.push({ exercise: ex, suggestedBpm });
    minutesUsed += ex.estimatedMinutes;
  }

  return plan;
}
