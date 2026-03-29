# Drumpath — Future Features Roadmap

**Created:** 2026-03-29  
**Status:** Backlog — not yet planned or implemented

---

## Feature 1: Pre-Assessment / Onboarding Quiz

**Summary:** Before a new user enters the app, walk them through a structured skill assessment so the system knows where they are starting from, rather than defaulting everyone to 0% mastery.

**User story:** As a new user, I want to rate my existing skills once at signup so that my practice plans reflect my actual level from day one.

**Key design questions:**
- Show all beginner skills first, then unlock intermediate ones based on beginner ratings
- Rating options: "Never tried / Heard of it / Can do it slowly / Comfortable"
- Map ratings to mastery scores via `onboardingRatingToScore` (already implemented)
- Trigger once on first login (store `onboarded: boolean` on user row)
- Allow re-taking from settings

**Touches:** `users` table (add `onboarded` column), new `OnboardingPage`, `POST /skills/onboard` (already exists)

---

## Feature 2: Shuffle / Randomise Today's Plan

**Summary:** Instead of always returning the deterministic lowest-mastery plan, allow users to shuffle or re-roll the plan for variety.

**User story:** As a practitioner, I want to occasionally mix up my session so I'm not always doing the exact same exercises in the same order.

**Key design questions:**
- Add a "Shuffle" button on the Practice page that re-generates the plan with some randomness
- Randomisation modes: purely random from available exercises, or weighted random (still bias toward low mastery)
- Could also allow user to pick session length (15 / 30 / 45 / 60 min) before generating
- Planner service (`planSession`) already sorts deterministically — add an optional `shuffle` parameter that adds controlled randomness to the priority sort

**Touches:** `PracticePage.tsx`, `planSession` service, `POST /plan/generate` (add `shuffle?: boolean` param)

---

## Feature 3: Audio / Video Instructions per Exercise

**Summary:** Each exercise card should link to or embed instructional audio/video so users know exactly how to perform the exercise without leaving the app.

**User story:** As a beginner, I want to see or hear what an exercise should sound like so I can practise correctly.

**Key design questions:**
- Storage: YouTube embed (no hosting cost) vs. uploaded files (S3/R2) vs. external URL field
- Recommended approach for v1: add `video_url TEXT` and `audio_url TEXT` columns to `exercises` table; populate via seed or admin UI
- Embed YouTube iframes on exercise cards; fall back gracefully if no URL is set
- For rudiments, the Vic Firth YouTube channel has free, high-quality clips for most standard rudiments
- Admin UI or seed-level curation needed to populate URLs

**Touches:** `exercises` table (new columns), `exercises.ts` route (include in response), `ExercisePage` or exercise card component (embed player)

---

## Feature 4: iOS App

**Summary:** A native iOS version of Drumpath so users can track sessions away from their computer (e.g. at a rehearsal space or lesson).

**User story:** As a drummer, I want to log practice sessions from my phone while sitting at the kit.

**Key design questions:**
- Approach A: **React Native / Expo** — reuse most of the existing React logic, share types
- Approach B: **Swift / SwiftUI** — native performance, better iOS integration (haptics, offline)
- Approach C: **Progressive Web App (PWA)** — add a manifest + service worker to the existing Vite app; works on iOS Safari with limitations
- Recommended path: PWA first (lowest cost, no App Store), then Expo if a real native feel is needed
- Offline support: cache the current plan locally; sync logs when back online
- The backend API is already REST-based and works from any client

**Touches:** `frontend/` (add `manifest.json`, service worker, mobile-optimised layouts), or new `ios/` Expo workspace

---

## Feature 5: Theory / Concept Walkthroughs with Quiz

**Summary:** For exercises tagged with theoretical or technique content (notation reading, grip, rudiment theory), include a structured markdown guide with images and a comprehension quiz.

**User story:** As a beginner, I want to understand *why* I'm doing an exercise — the theory behind it — and test myself to confirm I've understood.

**Design:**

### Content structure (per concept)

Each concept lives in a markdown file at `docs/concepts/<slug>.md`:

```
docs/concepts/
├── matched-grip.md
├── reading-notation.md
├── 4-4-time-signature.md
├── single-stroke-roll.md
└── ...
```

Each file follows this template:

```markdown
# Concept Title

## What you need to know
[Plain-English explanation, 200–400 words]

## Key points
- Bullet 1
- Bullet 2

## Images
![Alt text](https://example.com/image.jpg)
*Source: [Author / Site](https://source-url)*

## Quiz
<!-- quiz: multiple-choice -->
Q: What does 4/4 mean?
A: 4 beats per bar, quarter note gets the beat ✓
B: 4 bars per phrase
C: 4 notes per beat
D: Play at speed 4
```

### Implementation

- Add `concept_slug TEXT` column to `skills` table; skills with theory content reference a concept file
- New `ConceptPage` renders the markdown (use `react-markdown`) and the quiz inline
- Quiz state is local; on passing (e.g. 3/4 correct), record a `concept_completed` event or award a small mastery boost
- Images: link to external URLs with attribution — no hosting required; include `<figure>` + `<figcaption>` with source credit

**Touches:** `skills` table (add `concept_slug`), new `ConceptPage.tsx`, `react-markdown` dependency, `docs/concepts/` directory, seed data for concept slugs

---

## Priority Order (suggested)

| # | Feature | Effort | Value |
|---|---------|--------|-------|
| 1 | Pre-assessment onboarding | Low | High — fixes cold-start problem immediately |
| 2 | Shuffle plan | Low | Medium — quick win for variety |
| 3 | Theory walkthroughs + quiz | Medium | High — core educational value |
| 4 | Audio/video instructions | Medium | High — reduces beginner confusion |
| 5 | iOS app | High | High — but depends on user adoption first |

---

## Open Questions

- Should concepts be seeded as static markdown files or stored in the DB as rich text?
- For audio/video: curate manually or allow community contributions?
- iOS: PWA first or go straight to Expo?
- Quiz: does passing a quiz unlock a skill, or is it purely educational?
