#!/usr/bin/env bash
# Usage:
#   ./dev.sh               — use committed seed, start both servers
#   ./dev.sh --regenerate  — regenerate seed via Anthropic API, then start
#   ./dev.sh --setup-only  — apply schema + import seed, don't start servers

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/backend/.env"
SCHEMA_FILE="$SCRIPT_DIR/backend/src/db/schema.sql"
SEED_FILE="$SCRIPT_DIR/backend/data/seed-graph.json"

# ── colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

step()  { echo -e "${CYAN}${BOLD}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}  ✔ $*${NC}"; }
warn()  { echo -e "${YELLOW}  ⚠ $*${NC}"; }
die()   { echo -e "${RED}${BOLD}  ✖ $*${NC}" >&2; exit 1; }

# ── parse flags ──────────────────────────────────────────────────────────────
REGENERATE=false
SETUP_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --regenerate) REGENERATE=true ;;
    --setup-only) SETUP_ONLY=true ;;
    *) die "Unknown flag: $arg  (valid: --regenerate, --setup-only)" ;;
  esac
done

echo ""
echo -e "${BOLD}🥁  Drumpath Dev Runner${NC}"
echo "────────────────────────────────────────"

# ── load .env ────────────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  # Export only non-empty, non-comment lines (don't override already-set vars)
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
  set +a
  ok "Loaded $ENV_FILE"
else
  warn "No backend/.env found — relying on existing environment variables"
fi

DATABASE_URL="${DATABASE_URL:-}"
[[ -z "$DATABASE_URL" ]] && die "DATABASE_URL is not set. Add it to backend/.env"

# ── apply schema ─────────────────────────────────────────────────────────────
step "Applying DB schema"
psql "$DATABASE_URL" -f "$SCHEMA_FILE" -q 2>&1 \
  | grep -v '^$' \
  | sed 's/^/  /' \
  || die "Failed to apply schema. Is Postgres running and DATABASE_URL correct?"
ok "Schema applied"

# ── seed graph ───────────────────────────────────────────────────────────────
step "Seed data"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

if $REGENERATE; then
  if [[ -z "$ANTHROPIC_API_KEY" || "$ANTHROPIC_API_KEY" == "your-key-here" ]]; then
    warn "--regenerate requested but ANTHROPIC_API_KEY is not set."
    warn "Set it in backend/.env, then re-run with --regenerate."
    warn "Falling back to existing seed-graph.json."
  else
    echo "  Generating skill graph via Anthropic API (this takes ~30s)..."
    (cd "$SCRIPT_DIR" && npm run generate-graph --workspace=backend --silent) \
      || die "generate-graph failed. Check your API key."
    ok "Seed graph generated → backend/data/seed-graph.json"
  fi
fi

if [[ ! -f "$SEED_FILE" ]]; then
  die "backend/data/seed-graph.json not found.\n  Run with --regenerate and a valid ANTHROPIC_API_KEY."
fi

echo "  Importing seed data..."
(cd "$SCRIPT_DIR" && npm run import-seed --workspace=backend --silent) \
  || die "import-seed failed. Check DATABASE_URL and that the schema was applied."
ok "Seed data imported"

[[ "$SETUP_ONLY" == true ]] && { echo ""; ok "Setup complete. Exiting (--setup-only)."; echo ""; exit 0; }

# ── start servers ────────────────────────────────────────────────────────────
step "Starting servers"
echo "  Backend → http://localhost:${PORT:-3001}"
echo "  Frontend → http://localhost:5173"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop both servers.${NC}"
echo "────────────────────────────────────────"
echo ""

# Kill both child processes on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Prefix each line with a coloured label
prefix_lines() {
  local label="$1" colour="$2"
  while IFS= read -r line; do
    printf "${colour}[%s]${NC} %s\n" "$label" "$line"
  done
}

(cd "$SCRIPT_DIR" && npm run dev:backend --silent 2>&1 | prefix_lines "backend" "$GREEN") &
BACKEND_PID=$!

(cd "$SCRIPT_DIR" && npm run dev:frontend --silent 2>&1 | prefix_lines "frontend" "$CYAN") &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
