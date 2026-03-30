export type SkillCategory = 'Technique' | 'Rudiment' | 'Groove' | 'Coordination' | 'Theory';
export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional';
export type Feeling = 'Rough' | 'OK' | 'Good' | 'Nailed it';

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  level: SkillLevel;
  hasBpmTarget: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  notes: string;
  targetBpm: number | null;
  estimatedMinutes: number;
  skillIds: string[];
  videoUrl: string | null;
  audioUrl: string | null;
}

export interface ExerciseWithSkills extends Exercise {
  skills: Skill[];
}

export interface UserMastery {
  userId: string;
  skillId: string;
  score: number;
  qualifyingSessions: number;
  lastPracticedAt: Date | null;
}

export interface SessionExerciseLog {
  exerciseId: string;
  bpmReached: number | null;
  feeling: Feeling;
  minutesSpent: number;
}

export interface SkillWithMastery extends Skill {
  masteryScore: number;
  qualifyingSessions: number;
  prerequisiteIds: string[];
  lastPracticedAt: Date | null;
}
