# Where things stand right now

> Unlike the rest of this folder, this file is *overwritten* each session,
> not appended to.

Last updated: **2026-08-15**, Session 13 (loose-end cleanup, following
Session 12's documentation restructure).

Web bundle is **1.7.1** (bumped this session — pure JS/copy fixes, ships
OTA once merged, per `engineering/git-workflow.md`); native APK is
**versionCode 7 / versionName 1.4**, unchanged (nothing native touched);
database schema is **v13**. The app is a fully local-first India-focused personal
finance tracker — SMS auto-capture, manual entry, CSV import, budgets
(calendar/pay-cycle/envelope), EMI/bill/subscription/warranty tracking, net
worth with holdings, goals, nine visual "skins," and JSON/ZIP backup. No
AI/cloud parsing (removed in 1.1.9 — see `roadmap/decisions.md`).

## Right now, in one paragraph

The app was scaffolded 2026-07-14 as a Vite+React+Capacitor MVP (onboarding,
home, transactions, budgets, add-expense, SMS-based auto-capture) and built
out through direct pushes to `main` for its first ~9 versions before a
PR-based workflow started on 2026-07-21. From there it moved fast: OTA/APK
delivery got fixed (the app had been silently failing to update since 1.0.4),
goals/dashboards/bill-types/smart-patterns/theming landed (PRs #1–16), a
critical database-encryption bug that wiped user data on every update got
root-caused and fixed by removing SQLCipher entirely (PRs #17–23), a large
one-handed-UI overhaul plus Google's Jules agent contributing warranty/
cooling-off/split features happened next (PRs #24–38), then EMI progress
bars, warranty tracking, AI removal (Gemini was ripped out for being the only
network-calling, third-party-trusting part of the app), side-hustle/GST/
envelope budgeting, and the first native APK release with share-target/
reminders/haptics shipped (PRs #39–46). A direct-push burst (07-27 to 07-29,
no PR workflow) added event budgets, CSV import, ZIP export, and schema v13.
A five-day gap, then a design-heavy phase landed four new visual skins with a
depth engine, fixed a backup-restore bug that was quietly deleting data down
to just categories, and worked through a run of on-device UI bugs (Spatial
skin locking users out, an invisible confirm-dialog, broken tap-to-expand,
broken app-wide scrolling) each found and fixed same-day (PRs #47–60). Most
recently, the SMS parsing engine was rewritten to stop misreading bill
reminders as payments (PRs #61–62). Session 12 was documentation-only: it
recovered the full history (the repo had been examined as a shallow clone
that only went back to PR #27; unshallowing it revealed the real history
starts at PR #1) and restructured it per `docs/documentationandgitplaybook.md`.
Session 13 (this session) worked through every loose end Session 12
surfaced: closed 3 stale GitHub PRs with diff-verified evidence, fixed the
`.env.example`/README doc drift, fixed a real user-facing bug found along
the way (onboarding claimed data was encrypted — it isn't, hasn't been
since PR #17), and fixed the pull-to-refresh gesture's root cause.

## What's still pending / open

- **No automated tests beyond one file, no TypeScript/type-checking, no CI
  on pull requests** (`npm run lint` is oxlint only). Carried over from
  `roadmap/architecture.md` §8 — treated as roadmap/infrastructure work in
  Session 13, not a "loose end" to silently fix, since it's architecturally
  significant. `selectors.js`'s dozens of pure functions (injectable clock)
  remain the highest-value, lowest-friction place to start.
- **Nothing in Session 13 was verified on a real device** — the pull-to-
  refresh fix especially should be checked on a phone; see `findings.md`.
- **Web bundle 1.7.1 (this session's fixes) hasn't published yet** — that
  happens automatically once this branch's PR merges to `main` (see
  `features/ota-updates.md`).
- Deferred/dropped UI-audit findings and other minor known gaps: see
  `docs/PROJECT_HISTORY.md` §8 (not yet migrated into `roadmap/decisions.md`
  row-by-row — worth doing in a follow-up session, lower priority now that
  the higher-value loose ends are closed).
- All three previously-open PRs (#34, #37, #47) are now **closed** — see
  `roadmap/decisions.md` and `findings.md` for the resolution evidence.
- The `.env.example`/README AI-scanning drift is **fixed** as of this
  session.

## What's built and confirmed working

Everything shipped via OTA is build-verified (`npm run build` + `oxlint`)
before merge, per the PR discipline visible across all 62 PRs — but most PR
bodies are explicit that **on-device verification did not happen at merge
time** (no CI, no device in the build loop; several PRs say so directly,
e.g. "Not verified on a device" on #39, #40, #41, #42, #44, #45, #46). Actual
device confirmation shows up **retroactively**, as a bug report that triggers
a same-day fix PR (the collapsing-header saga across #25/#26/#28, the
Spatial-skin lockout, the invisible confirm-dialog, the pointer-capture
regression, the min-height scroll bug). Treat "shipped" and "confirmed
working on a real device" as different claims — the PR history itself does.

## Every session's own record

| Session | Date | Doc |
|---|---|---|
| 01 | 2026-07-14 | `sessions/2026-07-14-session-01.md` — Scaffold + MVP |
| 02 | 2026-07-15/16 | `sessions/2026-07-15-session-02.md` — Gemini fix, Part-1 bugs, SMS/pay-cycle |
| 03 | 2026-07-19 | `sessions/2026-07-19-session-03.md` — DB-open fix, SMS dedup, OTA via capacitor-updater |
| 04 | 2026-07-20/21 | `sessions/2026-07-20-session-04.md` — AU Bank parsing, auto-backup, Drive backup, budgets |
| 05 | 2026-07-21/22 | `sessions/2026-07-21-session-05.md` — OTA/APK pipeline fix, goals, themes, self-healing restore (PRs #1–16) |
| 06 | 2026-07-22/23 | `sessions/2026-07-22-session-06.md` — DB-encryption removal, cloud APK, frosted glass, motion (PRs #17–23) |
| 07 | 2026-07-23/25 | `sessions/2026-07-23-session-07.md` — One-handed UI overhaul, Jules integration, FK787 fix (PRs #24–38) |
| 08 | 2026-07-26/27 | `sessions/2026-07-26-session-08.md` — EMI/warranty, AI removal, native release (PRs #39–46) |
| 09 | 2026-07-27/29 | `sessions/2026-07-27-session-09.md` — Event budgets/CSV/ZIP/schema v13, five skins, direct-push |
| 10 | 2026-08-01/03 | `sessions/2026-08-01-session-10.md` — Repository study, four skins+depth engine, backup-restore fix, UI bug run (PRs #47–58) |
| 11 | 2026-08-02/03 | `sessions/2026-08-02-session-11.md` — Scroll fixes, SMS engine rewrite, parser-feedback export (PRs #59–62) |
| 12 | 2026-08-15 | `sessions/2026-08-15-session-12.md` — Documentation restructure |
| 13 | 2026-08-15 | `sessions/2026-08-15-session-13.md` — Closing every loose end from Session 12 (this session) |
