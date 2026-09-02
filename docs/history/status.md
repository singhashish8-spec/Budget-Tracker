# Where things stand right now

> Unlike the rest of this folder, this file is *overwritten* each session,
> not appended to.

Last updated: **2026-08-31**, Session 14 (full codebase audit, then fixing
every one of the 36 findings it turned up).

Web bundle is **1.7.1** (not yet re-bumped for this session's fixes — see
"still pending" below); native APK is **versionCode 7 / versionName 1.4**,
unchanged; database schema is **v13**. The app is a fully local-first
India-focused personal finance tracker — SMS auto-capture, manual entry,
CSV import, budgets (calendar/pay-cycle/envelope), EMI/bill/subscription/
warranty tracking, net worth with holdings, goals, nine visual "skins," and
JSON/ZIP backup. No AI/cloud parsing (removed in 1.1.9 — see
`roadmap/decisions.md`).

## Right now, in one paragraph

The app was scaffolded 2026-07-14 as a Vite+React+Capacitor MVP and built
out through direct pushes to `main` for its first ~9 versions before a
PR-based workflow started on 2026-07-21. From there it moved fast: OTA/APK
delivery got fixed, goals/dashboards/bill-types/smart-patterns/theming
landed (PRs #1–16), a critical database-encryption bug that wiped user
data on every update got root-caused and fixed by removing SQLCipher
entirely (PRs #17–23), a one-handed-UI overhaul plus Google's Jules agent
contributing warranty/cooling-off/split features happened next (PRs
#24–38), then EMI progress bars, warranty tracking, AI removal, side-
hustle/GST/envelope budgeting, and the first native APK release shipped
(PRs #39–46). A direct-push burst added event budgets, CSV import, ZIP
export, and schema v13 (07-27 to 07-29). A design-heavy phase landed four
new visual skins with a depth engine, fixed a backup-restore data-loss bug,
and worked through a run of on-device UI bugs (PRs #47–60). The SMS
parsing engine was then rewritten to stop misreading bill reminders as
payments (PRs #61–62). Session 12 recovered the project's full history
(the repo had been examined as a shallow clone) and restructured
documentation per `docs/documentationandgitplaybook.md`. Session 13 closed
every loose end Session 12 surfaced (3 stale PRs, doc drift, a false
onboarding encryption claim, the pull-to-refresh root cause). **Session 14
(this session)** ran a from-scratch, six-agent deep audit of the entire
codebase — 36 findings across 3 Critical / 15 High / 9 Medium / 9 Low — and
then fixed every one of them: two silent-money-correctness bugs and a
transaction-loss risk (Critical, in `db/sqlite.js` and
`scripts/release-apk.mjs`), quick-add/CSV-import/OTA-update-check/
notification/date-math/gesture bugs (High, 15 of 15), state/backup/CI-
workflow/native-plugin issues (Medium, 8 of 9 — the 9th confirmed
intentional), and a batch of smaller correctness/cleanup items (Low, 9 of
9 — one confirmed unreachable rather than patched). Two audit findings were
investigated and deliberately left unchanged, with the reasoning recorded
in `findings.md` and `roadmap/decisions.md` rather than silently dropped.

## What's still pending / open

- **Nothing from the 36-item Session 14 audit remains unaddressed** — every
  item was either fixed (34 of 36) or has a recorded, verified reason it
  wasn't (`DetentSheet`'s upward-drag threshold is intentional design;
  `repo.js`'s `WARRANTY_FIELDS` null guards are unreachable at every real
  call site) — see `findings.md` and `roadmap/decisions.md`.
- **No automated tests beyond what exists, no TypeScript/type-checking, no
  CI on pull requests** (`npm run lint` is oxlint only). Test coverage grew
  this session (43 → 66 tests: new files for `quickAdd.js`, `csvFormat.js`,
  `liveUpdate.js`, `date.js`), but CI itself remains unactioned —
  architecturally significant, not a "loose end" to silently add mid
  bug-fix pass.
- **Nothing in Session 14 was verified on a real device.** The two Pointer
  Events migrations (`BottomNav`, `DetentSheet`) and the warranty/bill
  date-math fixes are the highest-value things to check on a phone first —
  consistent with every prior session in this project's history.
- **Web bundle version not yet bumped for this session's fixes** — will
  happen once this branch's PR is reviewed; see `features/ota-updates.md`.
- Deferred/dropped UI-audit findings from before Session 12: see
  `docs/PROJECT_HISTORY.md` §8 (still not migrated into
  `roadmap/decisions.md` row-by-row — lower priority, unchanged from
  Session 13's note).

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
| 13 | 2026-08-15 | `sessions/2026-08-15-session-13.md` — Closing every loose end from Session 12 |
| 14 | 2026-08-31 | `sessions/2026-08-31-session-14.md` — Full 36-item codebase audit, then fixing every finding (this session) |
