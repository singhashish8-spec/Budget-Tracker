# Feature: Backup, restore & auto-recovery

> Part of `features/`. Status: **built** (started 2026-07-20, PR `75eb9a1`),
> **root-caused twice** (PRs #12, #49) — the single most bug-prone feature
> in the project's history. Read `history/findings.md` before touching this
> code.

## Summary

Three overlapping mechanisms: (1) automatic on-device snapshotting on every
data change, feeding a silent auto-restore when the database comes up
empty; (2) manual JSON export/import, including a Google Drive share-sheet
route; (3) a ZIP export bundling CSV+HTML+JSON+every warranty document.

## Why this exists

The app is offline-first with no server — the only copy of the user's
financial data is the on-device SQLite file. Given how many separate ways
that file has been lost across this project's history (SQLCipher key loss
across an update, a JS/native connection-state mismatch after an OTA
reload, a reinstall wiping the database outright), backup/restore isn't an
optional feature — it's the thing standing between a routine app update and
total data loss.

## What's built

- **`autoBackup.js`** — snapshots on every data change, to (per the
  repository study) three separate on-device locations, so a single storage
  failure doesn't cost the snapshot.
- **`backup.js`** — manual JSON export via the native share sheet (one tap
  to "Save to Drive," no OAuth needed) and import.
- **`zipExport.js`** — CSV + HTML + JSON + every warranty document,
  bundled.
- **Silent auto-restore** (PR #16) — if the DB comes up empty and a snapshot
  exists, restores automatically in the background rather than showing a
  prompt that could hang; a once-per-launch `sessionStorage` guard prevents
  a reload loop.
- **`errorLog.js`** (PR #49) — a capped, `localStorage`-backed (deliberately
  not DB-backed — see `roadmap/decisions.md`) ring buffer of the last 200
  failures, wired into every auto-backup write location, both boot-time
  recovery paths, and the database failing to open. Exposed at
  Settings → Backup → Diagnostics and included in the ZIP export.

## Bugs this feature produced (full writeups in `history/findings.md`)

- **Doubled all SMS-derived data on every restore** (PR #12) — `sms_log`
  (the SMS de-dup memory) was never included in backups; fixed by including
  it, then later *excluding* it again (PR #16, once it had grown large
  enough to cause the hang below) in favor of an independent
  timestamp+amount+direction idempotency guard.
- **The app hanging forever on "Restoring your data"** (PR #45) — a
  swallowed restore error left the loading overlay on screen with no way
  past, and `sessionStorage` resetting on every launch meant the same dead
  screen reproduced on every reopen. Fixed with a real failure path, a
  45-second deadline, and per-document isolation in `importBackup` so one
  oversized photo can't sink the whole restore.
- **Restoring silently returned only categories, everything else gone**
  (PR #49) — `importBackup()`'s transaction `INSERT` declared 15 columns
  but supplied 17 values (two columns added in PR #42 without updating the
  column list). SQLite rejected it on the first transaction row; every
  restore since PR #42 had been silently failing this way. This is the
  failure that PR #45's timeout fix made *survivable* but could not, from
  its vantage point, actually fix.
- **SQLCipher key loss across an app update bricked the database entirely**
  (PR #17) — see `roadmap/decisions.md`; the resolution (removing
  encryption) is an architectural decision, not a bug fix, but it's the
  same underlying "update breaks the database" problem this feature exists
  to survive.

## Open questions

- PR #49's own body: the end-to-end restore flow (as opposed to the
  corrected SQL statements, which were verified against a real
  `node:sqlite` database) has never been verified on an actual device with
  a real snapshot on disk — the Filesystem plugin and native SQLite driver
  are both stubbed in a web build.
- Given how many times "the restore path had a bug nobody could see" has
  recurred here, a real (not one-off-harness) automated test around
  `importBackup()`'s full round-trip would be disproportionately
  high-value relative to its cost — see `roadmap/architecture.md` §8.
