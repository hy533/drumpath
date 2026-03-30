# Feature 2: Shuffle Today's Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Shuffle" button to the Practice page that re-generates the plan with controlled randomness so users can vary their session without always getting the same deterministic order.

**Architecture:** Add an optional `shuffle?: boolean` parameter to `planSession` that introduces per-exercise random jitter (up to 50 mastery points) before sorting — low-mastery exercises are still prioritised on average but the order varies each call. The route `POST /plan/generate` passes the flag through from the request body. The frontend adds a "Shuffle" button that re-calls the endpoint with `shuffle: true`.

**Tech Stack:** TypeScript (backend service + route), React + Tailwind (frontend button), Jest (unit + integration tests)

---

## Existing code to know

- `backend/src/services/planner.ts` — `planSession(exercises, masteryMap, targetMinutes)` maps exercises to `{ ex, avgMastery }` then sorts ascending by `avgMastery`. **Needs patching** to accept `shuffle?: boolean` and add per-exercise jitter in the map phase.
- `backend/src/routes/plan.ts` — `POST /plan/generate` accepts `{ targetMinutes }` and calls `planSession`. **Needs patching** to also accept `shuffle?: boolean` and pass it through.
- `frontend/src/pages/PracticePage.tsx` — calls `POST /plan/generate` with `{ targetMinutes: 30 }` on mount. **Needs patching** to add a Shuffle button that re-fetches with `shuffle: true`.

---

## File Structure

```
backend/
  src/
    services/
      planner.ts                          # Modify: add shuffle param + jitter logic
    routes/
      plan.ts                             # Modify: parse + pass shuffle param
  tests/
    services/
      planner.test.ts                     # Modify: add shuffle tests
    routes/
      plan-shuffle.test.ts                # Create: integration test for shuffle route param

frontend/
  src/
    pages/
      PracticePage.tsx                    # Modify: add Shuffle button
```

---

## Task 1: Add `shuffle` parameter to `planSession`

**Files:**
- Modify: `backend/src/services/planner.ts`
- Modify: `backend/tests/services/planner.test.ts`

- [ ] **Step 1: Write failing tests for shuffle**

Add to the end of `backend/tests/services/planner.test.ts`:

```typescript
describe('planSession with shuffle', () => {
  const makeExercise = (id: string, masteryScore: number) => {
    const ex = exercise(id, 5, [id]);
    return { ex, mastery: new Map([[id, masteryScore]]) };
  };

  it('shuffle=false always produces deterministic order', () => {
    const { ex: e1, mastery: m1 } = makeExercise('s1', 10);
    const { ex: e2, mastery: m2 } = makeExercise('s2', 90);
    const mastery = new Map([...m1, ...m2]);
    const result1 = planSession([e1, e2], mastery, 30, false);
    const result2 = planSession([e1, e2], mastery, 30, false);
    expect(result1.map(p => p.exercise.id)).toEqual(result2.map(p => p.exercise.id));
  });

  it('shuffle=true still respects time budget', () => {
    const exercises = [
      exercise('a', 10, ['sa']),
      exercise('b', 10, ['sb']),
      exercise('c', 10, ['sc']),
      exercise('d', 10, ['sd']),
    ];
    const mastery = new Map([['sa', 10], ['sb', 20], ['sc', 30], ['sd', 40]]);
    const result = planSession(exercises, mastery, 25, true);
    const total = result.reduce((sum, p) => sum + p.exercise.estimatedMinutes, 0);
    expect(total).toBeLessThanOrEqual(25);
  });

  it('shuffle=true with mocked Math.random applies jitter to change order', () => {
    // e1 has mastery 10, e2 has mastery 20
    // Deterministic: e1 first (lower mastery)
    // With mocked jitter: e1 gets +50 (score=60), e2 gets +0 (score=20)
    // After shuffle: e2 first (20 < 60)
    const e1 = exercise('e1', 5, ['s1']);
    const e2 = exercise('e2', 5, ['s2']);
    const mastery = new Map([['s1', 10], ['s2', 20]]);

    const spy = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(1)   // e1 jitter = 1 * 50 = 50 → score = 10+50 = 60
      .mockReturnValueOnce(0);  // e2 jitter = 0 * 50 = 0  → score = 20+0  = 20

    const result = planSession([e1, e2], mastery, 30, true);
    spy.mockRestore();

    expect(result[0].exercise.id).toBe('e2'); // e2 (score 20) before e1 (score 60)
  });

  it('shuffle defaults to deterministic when omitted (no 4th argument)', () => {
    const { ex: e1, mastery: m1 } = makeExercise('s1', 10);
    const { ex: e2, mastery: m2 } = makeExercise('s2', 90);
    const mastery = new Map([...m1, ...m2]);
    // No 4th argument — should behave same as shuffle=false
    const result = planSession([e1, e2], mastery, 30);
    expect(result[0].exercise.id).toBe('e1'); // lower mastery first
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest tests/services/planner.test.ts --no-coverage
```

Expected: FAIL — `planSession` does not accept a 4th argument yet.

- [ ] **Step 3: Update `planSession` in `backend/src/services/planner.ts`**

Replace the entire file with:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest tests/services/planner.test.ts --no-coverage
```

Expected: All tests PASS (including the original 8 + new 4 shuffle tests = 12 total).

- [ ] **Step 5: Commit**

```bash
cd /Users/hanyuey/claude/drumpath
git add backend/src/services/planner.ts backend/tests/services/planner.test.ts
git commit -m "feat: add shuffle parameter to planSession with mastery-weighted jitter"
```

---

## Task 2: Accept `shuffle` in `POST /plan/generate`

**Files:**
- Modify: `backend/src/routes/plan.ts`
- Create: `backend/tests/routes/plan-shuffle.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `backend/tests/routes/plan-shuffle.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/db/client';

const app = createApp(db);

let token: string;
let userId: string;

beforeAll(async () => {
  // Register a user
  const res = await request(app)
    .post('/auth/register')
    .send({ email: 'shuffle-test@example.com', password: 'password123' });
  token = res.body.token;
  userId = res.body.userId;
});

afterAll(async () => {
  await db.query(`DELETE FROM users WHERE email = 'shuffle-test@example.com'`);
  await db.end();
});

describe('POST /plan/generate shuffle param', () => {
  it('accepts shuffle=true and returns a valid plan', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMinutes: 30, shuffle: true });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plan)).toBe(true);
  });

  it('accepts shuffle=false and returns a valid plan', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMinutes: 30, shuffle: false });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plan)).toBe(true);
  });

  it('omitting shuffle still returns a valid plan', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMinutes: 30 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plan)).toBe(true);
  });

  it('rejects invalid shuffle value', async () => {
    const res = await request(app)
      .post('/plan/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetMinutes: 30, shuffle: 'yes' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest tests/routes/plan-shuffle.test.ts --no-coverage
```

Expected: FAIL — the "rejects invalid shuffle value" test fails (route doesn't validate `shuffle` yet); other tests may pass since `shuffle` is currently ignored.

- [ ] **Step 3: Patch `backend/src/routes/plan.ts`**

Read the file first. Then update the `POST /generate` handler to parse and validate `shuffle`:

In the handler, after the `targetMinutes` validation block, add:

```typescript
const { targetMinutes, shuffle: shuffleRaw } = req.body as { targetMinutes?: unknown; shuffle?: unknown };

// ... existing targetMinutes validation ...

if (shuffleRaw !== undefined && typeof shuffleRaw !== 'boolean') {
  res.status(400).json({ error: 'shuffle must be a boolean' });
  return;
}
const shuffle = shuffleRaw === true;
```

Then change the `planSession` call from:
```typescript
const plan = planSession(exercises, masteryMap, targetMinutes);
```
to:
```typescript
const plan = planSession(exercises, masteryMap, targetMinutes, shuffle);
```

The full updated handler body (replace from the `try {` block through `const plan = ...`):

```typescript
router.post('/generate', requireAuth, async (req, res, next: NextFunction) => {
  const { targetMinutes, shuffle: shuffleRaw } = req.body as {
    targetMinutes?: unknown;
    shuffle?: unknown;
  };

  if (
    typeof targetMinutes !== 'number' ||
    !Number.isInteger(targetMinutes) ||
    targetMinutes <= 0
  ) {
    res.status(400).json({ error: 'targetMinutes must be a positive integer' });
    return;
  }

  if (shuffleRaw !== undefined && typeof shuffleRaw !== 'boolean') {
    res.status(400).json({ error: 'shuffle must be a boolean' });
    return;
  }
  const shuffle = shuffleRaw === true;

  try {
    // ... rest of the handler unchanged, just update the planSession call:
    const plan = planSession(exercises, masteryMap, targetMinutes, shuffle);
    res.status(200).json({ plan });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest tests/routes/plan-shuffle.test.ts --no-coverage
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd /Users/hanyuey/claude/drumpath/backend && NODE_ENV=test npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/hanyuey/claude/drumpath
git add backend/src/routes/plan.ts backend/tests/routes/plan-shuffle.test.ts
git commit -m "feat: accept shuffle param in POST /plan/generate"
```

---

## Task 3: Add Shuffle button to PracticePage

**Files:**
- Modify: `frontend/src/pages/PracticePage.tsx`

- [ ] **Step 1: Read the current PracticePage.tsx**

Read `frontend/src/pages/PracticePage.tsx` to understand the current structure before editing.

- [ ] **Step 2: Extract plan-fetching logic into a `fetchPlan` function and add shuffle state**

The current `useEffect` fires once on mount with a hardcoded `shuffle: false`. Refactor so the same logic can be called again by the Shuffle button.

Replace the state declarations and useEffect in `PracticePage.tsx` with:

```tsx
export default function PracticePage() {
  const { isAuthenticated } = useAuth();
  const [plan, setPlan] = useState<PlannedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchPlan = (shuffle: boolean) => {
    setError('');
    return apiFetch<PlanResponse>('/plan/generate', {
      method: 'POST',
      body: JSON.stringify({ targetMinutes: 30, shuffle }),
    })
      .then((data) => setPlan(data.plan))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to generate plan'));
  };

  useEffect(() => {
    fetchPlan(false).finally(() => setLoading(false));
  }, []);

  const handleShuffle = async () => {
    setShuffling(true);
    await fetchPlan(true);
    setShuffling(false);
  };

  const handleStartSession = async () => {
    // ... unchanged ...
  };
```

- [ ] **Step 3: Add the Shuffle button to the header row**

In the header `<div className="flex items-start justify-between">`, after the title+subtitle `<div>`, add the Shuffle button alongside the Start Session button:

```tsx
<div className="flex items-center gap-3">
  <button
    onClick={handleShuffle}
    disabled={shuffling || loading}
    className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 font-medium rounded-lg transition-colors border border-gray-700"
  >
    {shuffling ? 'Shuffling…' : '⟳ Shuffle'}
  </button>
  {plan.length > 0 && (
    <button
      onClick={handleStartSession}
      disabled={starting}
      className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
    >
      {starting ? 'Starting…' : 'Start Session'}
    </button>
  )}
</div>
```

Replace the existing conditional `{plan.length > 0 && <button>Start Session</button>}` with the above `<div>`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/hanyuey/claude/drumpath/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Manual smoke test**

Start both servers:
```bash
# Terminal 1
cd /Users/hanyuey/claude/drumpath/backend && npm run dev

# Terminal 2
cd /Users/hanyuey/claude/drumpath/frontend && npm run dev
```

1. Open http://localhost:5173 and log in
2. Navigate to the Practice page — plan should load as before
3. Click "⟳ Shuffle" — plan should reload with a different order (may occasionally be the same — that's fine, it's random)
4. Click "⟳ Shuffle" several times — order should vary
5. "Start Session" should still work after shuffling

- [ ] **Step 6: Commit**

```bash
cd /Users/hanyuey/claude/drumpath
git add frontend/src/pages/PracticePage.tsx
git commit -m "feat: add Shuffle button to PracticePage"
```

---

## Self-Review

**Spec coverage check:**
- ✅ "Shuffle" button on Practice page — Task 3
- ✅ Re-generates plan with randomness — Task 1 (jitter) + Task 2 (route param) + Task 3 (button)
- ✅ Weighted random: still biases toward low mastery — jitter is max 50 out of 0–100 mastery range
- ✅ `planSession` optional `shuffle` parameter — Task 1
- ✅ `POST /plan/generate` accepts `shuffle?: boolean` — Task 2
- ✅ Invalid `shuffle` value rejected with 400 — Task 2

**Placeholder scan:** None found.

**Type consistency:**
- `planSession(exercises, masteryMap, targetMinutes, shuffle?)` — defined Task 1, used in Tasks 1 and 2 with matching signature ✅
- `fetchPlan(shuffle: boolean)` — defined and used in Task 3 only ✅
- `shuffling: boolean` state — defined and used in Task 3 only ✅
