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

## Current task for this workspace (branch `simon`): merge into `main` by 12:00 on 15 Oct
Written by Tomáš (Claude Code) at 11:10. The same list in Czech is in `PLAN_FINAL.md`, chapter 16, on `main`. Do these steps in order. A trial merge of `tomas` + `simon` + `matous` had no conflicts and the frontend builds. After the merge, 32 of 36 backend tests pass. The 4 failures come from the points below.

1. **Merge `origin/tomas` into `simon` first** (`git fetch && git merge origin/tomas`). It contains `backend/app/core/`, `scripts/` and `public/data/` with the new data (Tomáš owns them; do not edit them).
2. **Fix `intensity_of` in `backend/app/services/access.py`.** `road["intensity"]` is a dict, not a number: `{"sv": vehicles_per_day, "src": "csd2025" | "odhad", "usek": census_section}`. Return `(road["intensity"]["sv"], road["intensity"]["src"])`. Today the API returns the whole dict as the vehicle count, and the quality is always "odhad". `RoadSummary.intensity` and `RoadSummary.intensity_src` hold the same values.
3. **Update 4 tests in `backend/tests/test_api.py`.** They expect "data not there yet", but the data now exists:
   - `test_closure_notifies_citizen_on_route`: `vehicles_per_day`, `vehicles_quality`, `students_per_day` and `cut_off_obce` now have values (assert type or `>= 0`, not `None`).
   - `test_flood_waits_for_engine`, `test_obce_are_names_until_dataset_arrives`, `test_demo_closures_from_current_network`: now `ready: True` (flood = `FloodResult`, obce = 448 items from Data KHK, demo closures = 20 real full closures from the 2022 plans).
4. **Label of `/api/demo-closures`.** `_demo_from_engine` sets `label: "demo data"`, but these are real closures planned by the kraj in 2022. Use `"skutečný plán 2022 (Data KHK)"`. Rule "label data honestly" applies both ways.
5. Run `cd backend && uv run pytest`. Then merge `simon` into `main` (fast-forward or PR) and push. Never force-push. Tell Matouš that `main` has the API.
6. Optional: in the FastAPI lifespan call `engine.people` and `engine.demo_closures()` once. Otherwise the first request waits about 3 s plus 5 s.

New `Engine` methods available after step 1 (details in `docs/BACKEND.md`, chapter 7). All return types are additive models in `core/schemas.py`:
- `students_on(road_id) -> int`: daily high-school students whose route uses the road.
- `people_impact(road_ids) -> PeopleImpact`: students, affected obce and cut-off obce for one closure over more roads.
- `cut_off_obce(road_id) -> list[ObecImpact]`: obce that lose road access to every hospital.
- `obce() -> list[dict]`: 448 obce (`kod`, `nazev`, `obyvatel`, `lon`, `lat`, `bbox`).
- `flood(level) -> FloodResult` and `flood_geojson(level)` for levels `q5`, `q20`, `q100`.
- `demo_closures(full_only=True) -> list[DemoClosure]`: real 2022 closures with detour, people, vehicles and alerts. Three have `recommended=True`.
- `srti_closures(on=None, active_only=False) -> list[SrtiClosure]`: current ŘSD / NDIC SRTI closures in the kraj (CC BY 4.0). `api/closures.py` `_srti` already calls it.
- `graph.detour_set(road_ids) -> DetourResult`: detour for a closure over more roads.

Note: T11 changed how points near a road are counted (only the nearest roads, not all within 450 m). Scores and ranking changed on purpose. If a test asserts a fixed ranking or score, update it.
