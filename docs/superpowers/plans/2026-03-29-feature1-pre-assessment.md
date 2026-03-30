# Feature 1: Pre-Assessment Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route new users through a one-time skill self-assessment after registration so their practice plan reflects their actual level from day one.

**Architecture:** Add an `onboarded` boolean column to `users`. Auth responses include this flag. After registration, the frontend redirects to `/onboarding` where the user rates available root skills (1–3). On submit, `POST /skills/onboard` saves mastery scores and flips `onboarded = true`. Subsequent logins skip onboarding if already done.

**Tech Stack:** PostgreSQL (ALTER TABLE), Express (existing routes patched), React + TypeScript + Tailwind (new OnboardingPage), React Router (new route + redirect logic)

---

## Existing code to know

- `POST /skills/onboard` already exists — accepts `{ ratings: [{skillId, rating}] }`, saves mastery scores. **Needs patching** to also set `onboarded = true`.
- `GET /skills/available` already exists — returns root skills (no prerequisites) for a new user. Used as the skill list to rate.
- Auth routes return `{ token, userId }` — **needs patching** to also return `onboarded: boolean`.
- `useAuth` hook stores `token` + `userId` in localStorage. **Needs patching** to also store `onboarded`.

---

## File Structure

```
backend/
  src/
    db/
      schema.sql                        # Modify: add onboarded column
      migrations/
        001-add-onboarded.sql           # Create: ALTER TABLE migration
    routes/
      auth.ts                           # Modify: return onboarded in login + register
      skills.ts                         # Modify: set onboarded=true in /onboard endpoint

frontend/
  src/
    hooks/
      useAuth.ts                        # Modify: store + expose onboarded flag
    pages/
      OnboardingPage.tsx                # Create: multi-step skill rating UI
      RegisterPage.tsx                  # Modify: redirect to /onboarding after register
      LoginPage.tsx                     # Modify: redirect to /onboarding if not onboarded
    App.tsx                             # Modify: add /onboarding route
```

---

## Task 1: Add `onboarded` column + migration

**Files:**
- Create: `backend/src/db/migrations/001-add-onboarded.sql`
- Modify: `backend/src/db/schema.sql`

- [ ] **Step 1: Create the migration file**

Create `backend/src/db/migrations/001-add-onboarded.sql`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Apply to both databases**

```bash
psql drumpath < /Users/hanyuey/claude/drumpath/backend/src/db/migrations/001-add-onboarded.sql
psql drumpath_test < /Users/hanyuey/claude/drumpath/backend/src/db/migrations/001-add-onboarded.sql
```

Expected: `ALTER TABLE` with no errors.

- [ ] **Step 3: Verify column exists**

```bash
psql drumpath -c "\d users"
```

Expected: `onboarded | boolean | not null | false` in the column list.

- [ ] **Step 4: Add column to schema.sql so future fresh installs include it**

In `backend/src/db/schema.sql`, find the `users` table definition and add the column:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 5: Commit**

```bash
cd /Users/hanyuey/claude/drumpath
git add backend/src/db/migrations/001-add-onboarded.sql backend/src/db/schema.sql
git commit -m "feat: add onboarded column to users table"
```

---

## Task 2: Return `onboarded` from auth routes + set it in onboard endpoint

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/routes/skills.ts`

- [ ] **Step 1: Write failing test for register returning onboarded**

Create `backend/tests/routes/auth-onboarded.test.ts`:

```typescript
import request from 'supertest';
import app from '../../src/app';
import { db } from '../../src/db/client';

afterAll(async () => {
  await db.query(`DELETE FROM users WHERE email = 'onboard-test@example.com'`);
  await db.end();
});

describe('auth onboarded field', () => {
  it('register returns onboarded: false', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'onboard-test@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.onboarded).toBe(false);
    expect(typeof res.body.token).toBe('string');
  });

  it('login returns onboarded: false for fresh user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'onboard-test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.onboarded).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest tests/routes/auth-onboarded.test.ts --no-coverage
```

Expected: FAIL — `expect(received).toBe(false)` — `onboarded` is undefined.

- [ ] **Step 3: Patch register route in `backend/src/routes/auth.ts`**

Find the register handler. Change the INSERT query to return `onboarded` and include it in the response. The register handler currently returns `{ token, userId }`. Update it to:

```typescript
// In the register route, change the INSERT to also SELECT onboarded:
const result = await client.query<{ id: string; onboarded: boolean }>(
  `INSERT INTO users (email, password_hash)
   VALUES ($1, $2)
   RETURNING id, onboarded`,
  [email, hash]
);
const { id: userId, onboarded } = result.rows[0];
const token = jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' });
res.status(201).json({ token, userId, onboarded });
```

- [ ] **Step 4: Patch login route in `backend/src/routes/auth.ts`**

Find the login handler. Change the SELECT to also fetch `onboarded` and include it in the response:

```typescript
// Change the SELECT query to:
const result = await client.query<{ id: string; password_hash: string; onboarded: boolean }>(
  `SELECT id, password_hash, onboarded FROM users WHERE email = $1`,
  [email]
);
// ...after bcrypt.compare passes:
const token = jwt.sign({ userId: row.id }, jwtSecret, { expiresIn: '7d' });
res.status(200).json({ token, userId: row.id, onboarded: row.onboarded });
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest tests/routes/auth-onboarded.test.ts --no-coverage
```

Expected: Both tests PASS.

- [ ] **Step 6: Patch `POST /skills/onboard` in `backend/src/routes/skills.ts`**

After the loop that saves mastery scores, add a query to set `onboarded = true`:

```typescript
// Add AFTER the mastery score inserts inside the transaction, before COMMIT:
await client.query(
  `UPDATE users SET onboarded = true WHERE id = $1`,
  [req.userId]
);
```

- [ ] **Step 7: Write a test for the onboard endpoint setting onboarded=true**

Add to `backend/tests/routes/auth-onboarded.test.ts`:

```typescript
import { getTestToken } from '../helpers/auth'; // we will create this helper in step 8
```

Actually, write a standalone test instead. Add this describe block to the same test file:

```typescript
describe('POST /skills/onboard sets onboarded=true', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'onboard-set@example.com', password: 'password123' });
    token = res.body.token;
    userId = res.body.userId;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE email = 'onboard-set@example.com'`);
  });

  it('login returns onboarded:true after calling /skills/onboard', async () => {
    // Get available skills first
    const skillsRes = await request(app)
      .get('/skills/available')
      .set('Authorization', `Bearer ${token}`);
    expect(skillsRes.status).toBe(200);

    // Submit ratings for all available skills
    const ratings = skillsRes.body.skills.map((s: { id: string }) => ({
      skillId: s.id,
      rating: 2,
    }));

    if (ratings.length > 0) {
      const onboardRes = await request(app)
        .post('/skills/onboard')
        .set('Authorization', `Bearer ${token}`)
        .send({ ratings });
      expect(onboardRes.status).toBe(200);
    }

    // Login should now return onboarded: true
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'onboard-set@example.com', password: 'password123' });
    expect(loginRes.body.onboarded).toBe(true);
  });
});
```

- [ ] **Step 8: Run all auth-onboarded tests**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest tests/routes/auth-onboarded.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/hanyuey/claude/drumpath
git add backend/src/routes/auth.ts backend/src/routes/skills.ts backend/tests/routes/auth-onboarded.test.ts
git commit -m "feat: return onboarded flag in auth responses, set on onboard submit"
```

---

## Task 3: Update `useAuth` to store `onboarded`

**Files:**
- Modify: `frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Update useAuth to store, expose, and update `onboarded`**

Replace the entire contents of `frontend/src/hooks/useAuth.ts` with:

```typescript
export function useAuth() {
  const token = localStorage.getItem('drumpath_token');
  const userId = localStorage.getItem('drumpath_userId');
  const onboarded = localStorage.getItem('drumpath_onboarded') === 'true';

  const login = (token: string, userId: string, onboarded: boolean) => {
    localStorage.setItem('drumpath_token', token);
    localStorage.setItem('drumpath_userId', userId);
    localStorage.setItem('drumpath_onboarded', String(onboarded));
  };

  const setOnboarded = () => {
    localStorage.setItem('drumpath_onboarded', 'true');
  };

  const logout = () => {
    localStorage.removeItem('drumpath_token');
    localStorage.removeItem('drumpath_userId');
    localStorage.removeItem('drumpath_onboarded');
  };

  return { token, userId, onboarded, login, logout, setOnboarded, isAuthenticated: !!token };
}
```

- [ ] **Step 2: Update `RegisterPage.tsx` to pass `onboarded` to `login()` and redirect to `/onboarding`**

In `frontend/src/pages/RegisterPage.tsx`, find the `login(data.token, data.userId)` call and the `navigate('/')` call. Replace them:

```typescript
interface AuthResponse {
  token: string;
  userId: string;
  onboarded: boolean;
}

// In handleSubmit, replace:
//   login(data.token, data.userId);
//   navigate('/');
// With:
login(data.token, data.userId, data.onboarded);
navigate('/onboarding');
```

- [ ] **Step 3: Update `LoginPage.tsx` to pass `onboarded` and redirect correctly**

In `frontend/src/pages/LoginPage.tsx`, find the login call and navigation. Update to:

```typescript
interface AuthResponse {
  token: string;
  userId: string;
  onboarded: boolean;
}

// In handleSubmit, replace the login + navigate calls with:
login(data.token, data.userId, data.onboarded);
navigate(data.onboarded ? '/' : '/onboarding');
```

- [ ] **Step 4: Commit**

```bash
cd /Users/hanyuey/claude/drumpath
git add frontend/src/hooks/useAuth.ts frontend/src/pages/RegisterPage.tsx frontend/src/pages/LoginPage.tsx
git commit -m "feat: store onboarded flag in auth, redirect new users to onboarding"
```

---

## Task 4: Build OnboardingPage

**Files:**
- Create: `frontend/src/pages/OnboardingPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/OnboardingPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface Skill {
  id: string;
  name: string;
  category: string;
  level: string;
  description: string;
}

const RATING_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Never tried',
  2: 'Getting there',
  3: 'Comfortable',
};

export default function OnboardingPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [ratings, setRatings] = useState<Record<string, 1 | 2 | 3>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { setOnboarded, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    apiFetch<{ skills: Skill[] }>('/skills/available')
      .then(({ skills }) => {
        setSkills(skills);
        const defaults: Record<string, 1 | 2 | 3> = {};
        skills.forEach((s) => (defaults[s.id] = 1));
        setRatings(defaults);
      })
      .catch(() => setError('Could not load skills. Please refresh.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const ratingsList = Object.entries(ratings).map(([skillId, rating]) => ({
        skillId,
        rating,
      }));
      await apiFetch('/skills/onboard', {
        method: 'POST',
        body: JSON.stringify({ ratings: ratingsList }),
      });
      setOnboarded();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  // Group skills by category
  const byCategory = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    (acc[skill.category] ??= []).push(skill);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading assessment…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-orange-400 mb-2">Welcome to Drumpath</h1>
          <p className="text-gray-400">
            Rate your comfort with each skill so we can build a practice plan that fits you.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, categorySkills]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-widest mb-3">
                {category}
              </h2>
              <div className="space-y-3">
                {categorySkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-100">{skill.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{skill.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {([1, 2, 3] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() =>
                            setRatings((prev) => ({ ...prev, [skill.id]: r }))
                          }
                          className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                            ratings[skill.id] === r
                              ? 'bg-orange-500 border-orange-500 text-white font-semibold'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-orange-500'
                          }`}
                        >
                          {RATING_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {skills.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-6">No skills to assess yet. You're all set!</p>
            <button
              onClick={() => { setOnboarded(); navigate('/'); }}
              className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
            >
              Start Practicing
            </button>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mt-10 text-center">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-10 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-lg"
            >
              {submitting ? 'Saving…' : 'Start Practicing →'}
            </button>
            <p className="text-xs text-gray-500 mt-3">
              You can always retake this from your profile settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `/onboarding` route to `frontend/src/App.tsx`**

In `App.tsx`, add the import and route:

```tsx
import OnboardingPage from './pages/OnboardingPage';

// Add inside <Routes> before the catch-all:
<Route path="/onboarding" element={<OnboardingPage />} />
```

- [ ] **Step 3: Start both servers and verify manually**

```bash
# Terminal 1
cd /Users/hanyuey/claude/drumpath/backend && npm run dev

# Terminal 2
cd /Users/hanyuey/claude/drumpath/frontend && npm run dev
```

1. Open http://localhost:5173/register
2. Register a new account → should redirect to `/onboarding`
3. Skills should load grouped by category with 3 rating buttons each
4. Click "Start Practicing" → should redirect to `/`
5. Log out and log back in → should go directly to `/` (already onboarded)
6. Open http://localhost:5173/register again with a different email → register → onboarding appears again

- [ ] **Step 4: Commit**

```bash
cd /Users/hanyuey/claude/drumpath
git add frontend/src/pages/OnboardingPage.tsx frontend/src/App.tsx
git commit -m "feat: add pre-assessment onboarding page"
```

---

## Self-Review

Spec coverage check:
- ✅ New users directed to assessment before app
- ✅ Skills rated 1–3 (Never tried / Getting there / Comfortable)
- ✅ Ratings saved via existing `POST /skills/onboard` → mastery scores seeded
- ✅ `onboarded` flag persisted in DB + localStorage
- ✅ Returning users skip onboarding (login redirects to `/` when `onboarded: true`)
- ✅ Skills grouped by category
- ✅ Empty state handled (no skills = skip onboarding gracefully)
- ✅ "Retake from profile settings" note shown (settings UI deferred to Profile feature)
