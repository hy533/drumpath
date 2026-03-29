import type { ExerciseWithSkills, PlannedExercise } from '../types';

/**
 * Generates a time-bounded, prioritised practice plan.
 *
 * @param masteryMap - skillId → mastery score (0–100).
 *   Skills absent from the map are treated as 0% mastery (= highest priority /
 *   lowest starting BPM). Callers should ensure every skill referenced by an
 *   exercise's `skills` array has an entry, or accept that unknown skills are
 *   treated as unpractised.
 * @param targetMinutes - target session length; the returned plan will not
 *   exceed this duration. A value ≤ 0 always returns an empty plan.
 */
export function planSession(
  exercises: ExerciseWithSkills[],
  masteryMap: Map<string, number>,
  targetMinutes: number,
): PlannedExercise[] {
  if (targetMinutes <= 0) return [];
  const prioritized = exercises
    .map(ex => {
      const avgMastery = ex.skills.length === 0
        ? 50
        : ex.skills.reduce((sum, s) => sum + (masteryMap.get(s.id) ?? 0), 0) / ex.skills.length;
      return { ex, avgMastery };
    })
    .sort((a, b) => a.avgMastery - b.avgMastery);

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
