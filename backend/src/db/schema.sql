CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Technique', 'Rudiment', 'Groove', 'Coordination', 'Theory')),
  description TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'Professional')),
  has_bpm_target BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_prerequisites (
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  prerequisite_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, prerequisite_id)
);

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  target_bpm INTEGER,
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_skills (
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, skill_id)
);

CREATE TABLE IF NOT EXISTS user_mastery (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  qualifying_sessions INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES practice_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  bpm_reached INTEGER,
  feeling TEXT CHECK (feeling IN ('Rough', 'OK', 'Good', 'Nailed it')),
  minutes_spent INTEGER,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session_id ON session_exercises(session_id);
