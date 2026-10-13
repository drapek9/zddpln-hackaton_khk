# AGENTS.md: shared rules for AI coding agents

These rules apply to Cursor (Šimon, macOS), Claude Code (Tomáš, Windows) and any other agent.
`CLAUDE.md` imports this file, and Cursor reads `AGENTS.md` natively.

## Project
Cesty KHK is a web app for Hackathon KHK 2026 (15 Oct 2026). It works with open data of the Královéhradecký kraj. It has two parts:
- **Repair prioritization:** score, classes, budget scenario.
- **Closure impacts:** detour, vehicles per day, alerts, notifying citizens.

Read these documents first:
- `PLAN_FINAL.md`: product plan, in Czech.
- `docs/BACKEND.md`: backend split, API contract and milestones, in Czech.
- `docs/FRONTEND.md`: frontend plan; it also lists the questions an agent must ask Matouš first.

## Language
- UI text, commit messages and docs for the team are **Czech**.
- Code, identifiers and comments in new Python code are English.
- Keep the existing Czech comments in the frontend.

## Layout and ownership
Do not edit a file area that someone else owns. Ask the owner first, so two people never edit the same files.

| Path | Owner | What |
|---|---|---|
| `backend/app/core/` | Tomáš | Pure domain logic: data loading, scoring, classes, road graph, detour, route, budget scenario. No FastAPI imports. |
| `backend/app/api/`, `backend/app/db/`, `backend/app/auth/`, `backend/app/notify/`, `backend/app/ai/`, `backend/app/main.py` | Šimon | FastAPI app, SQLite, users and roles, audit, push and e-mail, AI, export endpoints |
| `backend/app/core/schemas.py` | shared contract | Changes need agreement from both. Only add fields; never rename or remove them. |
| `src/`, `index.html`, `public/` (except `public/data`) | Matouš | Frontend and design |
| `scripts/`, `public/data/` | Tomáš | Data pipeline and snapshot |

## Commands (identical on macOS and Windows)
```
# backend
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest

# frontend (proxies /api to :8000)
npm install
npm run dev
```
- Use `uv`. Do not use pip or a global Python.
- Use forward-slash paths and `pathlib` in Python.
- Never hard-code `C:\` or `/Users/...`.

## Rules
- **Secrets only in `.env`.** It is gitignored; `.env.example` holds the placeholders. The repo is public.
- **No AI co-author trailers.** Do not add `Co-Authored-By: Claude`, Cursor or Copilot lines, and do not add "Generated with …" to PRs.
- **Label data honestly.** Mark simulated data `simulated` and estimates `estimate`. Every external dataset goes on the "Zdroje dat" page.
- **Deterministic score.** The score is always deterministic. AI only explains and proposes, and a human confirms.
- **Branches.** Work on your own branch (`tomas`, `simon`, `matous`, `premek`) and merge into `main` via PR or fast-forward. Never force-push `main`.
- **Tests.** Run `uv run pytest` before every push that touches `backend/`.
