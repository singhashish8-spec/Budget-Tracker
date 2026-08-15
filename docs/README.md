# Budget Tracker — docs

An India-focused personal finance app. One React/Vite codebase renders the UI;
a Capacitor Android shell supplies native capabilities (SQLite, SMS inbox,
biometrics, notifications, camera, print, share-target). Offline-first,
device-local, no server component.

Current state: web bundle **1.7.0**, native APK **versionCode 7 / versionName
1.4**, database schema **v13**. See `history/status.md` for the live detail.

## Where things live

This follows the two-kinds-of-truth split: **current state** (overwritten as
it changes) lives separately from **what happened, in order** (append-only,
never edited after the fact).

- **`history/`** — the append-only record. `status.md` (current state, read
  this first), `findings.md` (cross-session lessons), `sessions/` (one file
  per work session, backfilled from the full PR/commit history through
  2026-08-15).
- **`roadmap/`** — `decisions.md` (every real decision made, one row each),
  `architecture.md` (the technical reference — stack, data flow, invariants),
  `phases.md` (the build plan).
- **`features/`** — one file per major shipped feature: what it does, why it
  exists, what's actually built.
- **`engineering/`** — tech stack, folder structure, git workflow,
  environment/secrets setup.
- **`PROJECT_HISTORY.md`** (repo root of `docs/`) — the original single-file
  history/guide doc (written through 1.5.7). Kept as a legacy reference; the
  structured docs above supersede it going forward. It undercounts the
  project's real history — it treats **PR #27 / v1.0.32 as the earliest
  recorded version**, when the actual git history (recovered by unshallowing
  the repo) goes back to the project's actual start, PR #1, v1.0.9-era. The
  `history/sessions/` backfill below covers that missing ~26 PRs of
  foundational work.

## Reading order for a new session (human or AI)

1. `history/status.md` — where things stand right now, in one place.
2. `roadmap/decisions.md` — skim the whole table; it's the project's decision
   history in one screen.
3. Whatever `status.md` links you to next — a specific session, finding, or
   feature doc.
