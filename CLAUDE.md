# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The git root contains a single nested project directory. **All commands below must be run from `wedding-seating-cloudrun/`**, not the repo root:

```
/                              ← git root (.gitignore only)
└── wedding-seating-cloudrun/  ← actual project (package.json, server.js, src/, Dockerfile)
```

UI strings, comments, and docs are in Japanese; preserve Japanese text when editing.

## Commands

Run from `wedding-seating-cloudrun/`:

- `npm install` — install deps
- `npm run dev` — runs `node server.js` (API on :8080) and `vite` (frontend on :5173) concurrently via `concurrently`. Vite proxies `/api/*` → `:8080`.
- `npm run build` — produces `dist/`
- `npm run start` — production mode: `server.js` serves `dist/` as static and exposes the API on `$PORT` (default 8080)
- `USE_FIRESTORE=false npm run start` — run without Firestore, using in-memory store (useful for local testing without GCP creds)

There is no test runner, linter, or formatter configured. Do not invent one.

## Cloud Run deploy

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/wedding-seating
gcloud run deploy wedding-seating \
  --image gcr.io/YOUR_PROJECT_ID/wedding-seating \
  --platform managed --region asia-northeast1 --allow-unauthenticated
```

The `Dockerfile` is a two-stage Node 20 build: first stage runs `npm install` + `npm run build`, second stage copies the whole `/app` and runs `npm run start`. Both frontend assets and API are served from the same container.

## Architecture

**Single-container full-stack app**: `server.js` is the entry point in production. It mounts the Express API at `/api/*` and, if `dist/` exists, serves the SPA from it with a catch-all `app.get('*')` falling back to `index.html`. In dev, Vite serves the SPA separately and proxies API calls.

**Storage layer (`server.js`)** has a dual backend controlled by `USE_FIRESTORE` (default `true`):
- Firestore: collection `wedding_seating_projects`, doc id = projectId
- In-memory `Map` fallback (also used as a write-through cache alongside Firestore)
- If Firestore init throws, server logs and degrades to memory-only — this is intentional, don't make it fatal.

**API surface** (only three endpoints; keep it this small):
- `GET /api/health` — returns `{ ok, storage, now }`
- `GET /api/projects/:projectId` — returns project doc, or `getDefaultProject(projectId)` when missing (note: default is *returned* but not persisted on read)
- `PUT /api/projects/:projectId` — validates payload shape (`guests` array, `layouts` array, `activeLayoutId` string) and writes through to Firestore + memory

`projectId` is sanitized server-side via `cleanProjectId` (strips non-alphanumeric/`_-`, max 64 chars). Mirror this if adding new project-scoped endpoints.

**Frontend (`src/App.jsx`)** is a single ~700-line React component. Important conventions:
- Project identity comes from URL query `?p=<id>`, then `localStorage.wedding_project_id`, then a freshly generated `plan-xxxxxxxx`. The chosen id is written back to the URL (`history.replaceState`) and to localStorage. URL sharing = collaboration.
- Autosave: a 1200 ms debounced `setTimeout` PUTs `{ guests, layouts, activeLayoutId }` whenever those change. `loadedRef` gates this so the initial load doesn't trigger a save.
- Data model: `guests[]` is global per project; `layouts[]` each contain `tables[]`, `assignments` (`{ tableId: { seatIndex: guestId } }`), and `gridCols`. `activeLayoutId` selects the visible layout. The default layout id is `'l1'`.
- `guestLocationMap` (memoized inverse of `assignments`) is the source of truth for "where is guest X seated" — use it instead of scanning assignments.
- Drag/drop uses native HTML5 DnD with `dataTransfer` keys `type` (`'guest'` or `'table'`), `guestId`, `sourceTableId`. Mobile (matchMedia `max-width: 900px`) switches to a tap-select-then-tap-seat flow via `selectedGuestIdMobile`; the same `handleGuestAssignment` handles both.
- Seat geometry is computed inline: seats laid out on a circle of radius `ui.radius` at angles `i * 360/capacity - 90`. The `ui` object maps `gridCols` (1–4) and `isMobile` to `tableSize`/`radius`/`seatSize`.

**CSV format** (import expects header row, then): `氏名,側,カテゴリー,肩書き,テーブル,席番号,備考`. `側` accepts `新郎`/`groom` vs `新婦`/`bride`. Tables are auto-created by name; `備考` containing `検討中` marks the guest tentative. Export prepends a UTF-8 BOM.

## Branch convention

This environment requires development on `claude/add-claude-documentation-gFSlk`. Push only to that branch; do not open PRs unless explicitly asked.
