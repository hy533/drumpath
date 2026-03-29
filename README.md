# 🥁 Drumpath

A web app for learning drums — tracks your skill progression through a prerequisite graph, generates personalised practice plans, and logs session results to measure mastery over time.

## Features

- **Skill graph** — 30+ drum skills across Technique, Rudiment, Groove, Coordination, and Theory, linked by prerequisites (you unlock new skills as you master their foundations)
- **Mastery tracking** — each skill progresses through 0 → 33 → 66 → 100% as you complete qualifying practice sessions
- **Practice planner** — generates a time-bounded session plan (e.g. 30 min), prioritising your weakest skills and scaling suggested BPM to your current mastery
- **Session logging** — log BPM reached, feeling (Rough / OK / Good / Nailed it), and time spent per exercise; mastery updates automatically after each session
- **Onboarding** — self-rate existing skills (1–3) to fast-forward mastery for things you already know

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express 4 + TypeScript |
| Database | PostgreSQL |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| AI seed generation | Anthropic Claude API (optional) |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL running locally
- (Optional) Anthropic API key — only needed to regenerate the skill graph

### 1. Clone and install

```bash
git clone https://github.com/hy533/drumpath.git
cd drumpath
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configure environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://localhost:5432/drumpath
DATABASE_URL_TEST=postgresql://localhost:5432/drumpath_test
JWT_SECRET=your-secret-here
PORT=3001

# Optional — only needed for `./dev.sh --regenerate`
ANTHROPIC_API_KEY=your-key-here
```

### 3. Create the databases

```bash
psql postgres -c "CREATE DATABASE drumpath;"
psql postgres -c "CREATE DATABASE drumpath_test;"
```

### 4. Run

```bash
./dev.sh
```

That's it. The script applies the schema, imports seed data, and starts both servers.

| URL | Service |
|-----|---------|
| http://localhost:5173 | Frontend |
| http://localhost:3001 | Backend API |
| http://localhost:3001/health | Health check |

## Dev Script

```bash
./dev.sh                # apply schema + import seed + start both servers
./dev.sh --regenerate   # regenerate skill graph via Anthropic API, then start
./dev.sh --setup-only   # apply schema + import seed, don't start servers
```

## Project Structure

```
drumpath/
├── backend/
│   ├── src/
│   │   ├── db/           # PostgreSQL client
│   │   ├── middleware/   # JWT auth middleware
│   │   ├── routes/       # Express routers (auth, skills, exercises, sessions, plan)
│   │   ├── services/     # Business logic (graph, mastery, planner)
│   │   ├── types/        # Shared TypeScript types
│   │   ├── app.ts        # Express app factory
│   │   └── server.ts     # Entry point
│   ├── scripts/
│   │   ├── generate-graph.ts   # AI-powered skill graph generator
│   │   └── import-seed.ts      # Imports seed-graph.json into Postgres
│   ├── data/
│   │   └── seed-graph.json     # Hand-crafted drum skill graph (31 skills, 30 exercises)
│   └── tests/            # Integration tests (53 tests)
├── frontend/
│   └── src/
│       ├── api/          # fetch wrapper with auth headers
│       ├── components/   # Layout, nav
│       ├── hooks/        # useAuth (localStorage-backed)
│       ├── pages/        # Login, Register, Dashboard, Skills, Practice, Session
│       └── types/        # Shared TypeScript types
└── dev.sh                # One-command dev runner
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register with email + password |
| POST | `/auth/login` | — | Login, receive JWT |
| GET | `/skills` | ✓ | Full skill graph with mastery scores |
| GET | `/skills/available` | ✓ | Skills unlocked and not yet mastered |
| POST | `/skills/onboard` | ✓ | Bulk-set mastery from self-assessment |
| GET | `/exercises` | ✓ | All exercises |
| POST | `/plan/generate` | ✓ | Generate a timed practice plan |
| POST | `/sessions` | ✓ | Start a practice session |
| POST | `/sessions/:id/exercises` | ✓ | Log an exercise + update mastery |
| POST | `/sessions/:id/end` | ✓ | End session, get total minutes |

## Mastery System

A skill progresses when you complete a **qualifying session**: feeling is "Good" or "Nailed it", and BPM reached ≥ target (or exercise has no BPM requirement).

| Qualifying sessions | Mastery score |
|--------------------|---------------|
| 0 | 0% |
| 1 | 33% |
| 2 | 66% |
| 3 | 100% (mastered) |

Mastering a skill unlocks any skills that list it as a prerequisite.

## Running Tests

```bash
cd backend && npm test
```

53 integration tests covering all routes and services against a real test database.

## Regenerating the Skill Graph

The committed `seed-graph.json` contains a hand-crafted skill graph. To generate a richer AI-powered version:

1. Set `ANTHROPIC_API_KEY` in `backend/.env`
2. Run `./dev.sh --regenerate`

The script prompts Claude to produce 30–40 skills and 50–60 exercises, validates the output, and imports it into the database.
