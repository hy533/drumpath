import type { ExerciseWithSkills, PlannedExercise } from '../types';

export function planSession(
  exercises: ExerciseWithSkills[],
  masteryMap: Map<string, number>,
  targetMinutes: number,
): PlannedExercise[] {
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
