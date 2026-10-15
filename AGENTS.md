# AGENTS.md: shared rules for AI coding agents

These rules apply to Cursor (Šimon, macOS), Claude Code (Tomáš, Windows) and any other agent.
`CLAUDE.md` imports this file, and Cursor reads `AGENTS.md` natively.

## Project
Cesty KHK is a web app for Hackathon KHK 2026 (15 Oct 2026). It works with open data of the Královéhradecký kraj. It has two parts:
- **Repair prioritization:** score, classes, budget scenario.
- **Closure impacts:** detour, vehicles per day, alerts, notifying citizens.

**TOP PRIORITY (15 Oct): the next trial merge into `main` is at 15:00, then every 30 minutes (15:30, 16:00, 16:30, …).** Before each slot, have your branch pushed, with passing tests and mergeable with `main`.

Read these documents first:
- `PLAN_FINAL.md`: product plan, in Czech.
- `docs/BACKEND.md`: backend split, API contract and milestones, in Czech.
- `docs/FRONTEND.md`: frontend plan; it also lists the questions an agent must ask Matouš first.
- `NAPADY.md`: ideas that **do not exist yet** and still need to be discussed, in Czech. They are not tasks. Do not implement anything from it unless it was moved into `PLAN_FINAL.md`.
- `docs/STAV_A_DOPORUCENI.md`: project status on 15 Oct, risks and the recommended order of work for the hackathon day, in Czech. It changes priorities, not ownership.

Before each block of work, run `git fetch` and read new changes to these plans on `origin/main`. Only add to the plans; mark outdated parts **NEAKTIVNÍ** instead of deleting them.

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
- **Branches.** Work on your own branch (`tomas`, `simon`, `matous`, `premek`). The only direct push to `main` is a correction of `NAPADY.md`. Every other change goes to your own branch and reaches `main` only via PR or fast-forward. Never force-push `main`. In this Cursor workspace the own branch is `simon`.
- **Tests.** Run `uv run pytest` before every push that touches `backend/`.

## TOP PRIORITY (15 Oct, from 16:15): two task lists, read first
These override the list below. Each item has a "done when" check.
- **Frontend (Matouš):** `docs/TODO_FRONTEND.md`. Rename "Úředník" to "Správce" in the UI; ranking toggle "Jen parametry / Parametry + AI" with an "návrh AI" label; all 14 weights with numeric input; everything on the map clickable; separate colour channels for road condition and repairs; sidebar scroll and width; no overlapping panels. **Verify every item with Playwright** (desktop and mobile, light and dark, no console errors).
- **Backend (Šimon, Tomáš):** `docs/TODO_BACKEND.md`. `GET /api/ranking?mode=ai` (`app/ai/ranking.py` `reorder_window` exists but no endpoint calls it), `GET /api/weights/schema`, coverage of other roads except private ones.

## PRIORITY TODO (15 Oct, from 15:00): read this before any work
The same list in Czech is at the top of `PLAN_FINAL.md` ("TODO TEĎ") and in chapter 25. Anything not listed here has lower priority.

1. **Tomáš:** trial merge of `tomas` + `simon` + `matous` into `main` at 15:00, 15:30 and 16:00. After each: `uv run pytest`, `npm run build`, `scripts/smoke_api.sh`.
2. **Matouš (frontend):** chapter 25, phase 1. Three addresses from one build: `/` public and citizen, `/sprava` official (main target group), `/admin` admin **without a map**. Use `location.pathname` and `history.pushState`; no new router library.
3. **Login forms per address (25.8):** `/sprava` and `/admin` each have their own login form with a different look, **no registration and no demo shortcut**. `/` has a quick citizen login, registration and "Pokračovat bez přihlášení". Admins never register. Officials only **request access** on `/sprava`; an admin approves it and the e-mail is verified (chapter 25.10, phase 2).
4. **Production details (25.9), Matouš + Přemek:** custom 404, 403 and "server unavailable" pages, a React error boundary, page titles per route, `<html lang="cs">`, favicon, loading/empty/error states, Czech number and date formats, no console errors, no "undefined"/"NaN" in the UI.
5. **Šimon (backend):** S34 demo accounts `obcan`, `spravce`, `admin` that log in by short name (`spravce` means `spravce@cesty-khk.test`). Their simple passwords come **only from `.env`** (`CESTY_SEED_*_PASSWORD`); the repo is public. Then B‑5: `home` ("/", "/sprava", "/admin") in the `login` and `me` responses. Then chapter 22 (S27–S32).
6. **Přemek:** pitch, PDF/PPTX, backup video. The demo walks through `/sprava` (★1), `/` (★2), `/admin` (★3). Dry run on `main` through the tunnel at 15:30.
7. **16:00 feature freeze.** After that only bug fixes. **17:15 submission.**

Backend functions the frontend should call instead of computing locally (chapter 25.5, phase 2): ranking filters and sorting (B‑1), search (B‑2), weight presets (B‑3), ranking diff (B‑4), admin overview (B‑7), closure and audit filters (B‑8, B‑9). Core logic: Tomáš (`backend/app/core/`). Endpoints: Šimon.

## Engine reference (for backend work)
`Engine` methods; details are in `docs/BACKEND.md`, chapter 7. All return types are additive models in `core/schemas.py`:
- `students_on(road_id) -> int`: daily high-school students whose route uses the road.
- `people_impact(road_ids) -> PeopleImpact`: students, affected obce and cut-off obce for one closure over more roads.
- `cut_off_obce(road_id) -> list[ObecImpact]`: obce that lose road access to every hospital.
- `obce() -> list[dict]`: 448 obce (`kod`, `nazev`, `obyvatel`, `lon`, `lat`, `bbox`).
- `flood(level) -> FloodResult` and `flood_geojson(level)` for levels `q5`, `q20`, `q100`.
- `demo_closures(full_only=True) -> list[DemoClosure]`: real 2022 closures with detour, people, vehicles and alerts. Three have `recommended=True`.
- `srti_closures(on=None, active_only=False) -> list[SrtiClosure]`: current ŘSD / NDIC SRTI closures in the kraj (CC BY 4.0). `api/closures.py` `_srti` already calls it.
- `graph.detour_set(road_ids) -> DetourResult`: detour for a closure over more roads.

Note: T11 changed how points near a road are counted (only the nearest roads, not all within 450 m). Scores and ranking changed on purpose. If a test asserts a fixed ranking or score, update it.
