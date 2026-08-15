# Git workflow

> Codifies both the discipline from `documentationandgitplaybook.md` and the
> conventions actually visible across this project's 62 real PRs — the two
> agree closely, which is why this file mostly documents existing practice
> rather than prescribing new rules.

## Branching and PRs

- **One feature branch per unit of work**, never commit straight to `main`
  — this has held for nearly the entire recovered history. The exceptions
  are Session 01–04 (2026-07-14 to 07-21, before any PR workflow existed)
  and Session 09 (2026-07-27/29, a direct-push burst outside the normal
  flow) — see `history/sessions/`.
- **PRs, not direct pushes to main**, even solo. Every PR body in this
  project states what was verified (`npm run build`, `npm run lint`) before
  merge.
- **Small, real commits** within a branch, each a coherent working change —
  visible throughout, e.g. the three-attempt collapsing-header fix
  (PRs #25/26/28) shipped as three separate, individually-buildable PRs
  rather than one squashed "fix header" commit.
- **Commit/PR messages explain why, not just what.** Nearly every PR body in
  this project's history opens with a "Why"/root-cause section before the
  "What changed" section — follow that pattern; it's what makes
  `history/sessions/` backfillable from PR bodies alone, which is literally
  how this session reconstructed 11 files of project history without a
  single live transcript.

## Quality gates before every commit that touches code

Consistent across the whole recovered history:

- `npm run build` (Vite) — must pass clean.
- `npm run lint` (oxlint) — no *new* warnings against the established
  baseline (the baseline itself has drifted from 3 to 2 pre-existing
  warnings across the project's life; check the current count in the repo
  rather than assuming a fixed number).
- `npm test` (`node --test`) where the change touches `smsParse.js` — the
  33-case suite exists specifically to catch parser regressions; see
  `features/sms-engine.md`.
- **There is no CI enforcing any of this on pull requests** — see
  `roadmap/architecture.md` §8. These gates are currently honor-system,
  run and reported in the PR body by whoever opens it. If this project ever
  adds PR-triggered CI, this file's gate list is exactly what it should
  run.

## Versioning

- **OTA release** (pure JS/CSS/data changes, no native/plugin/Capacitor
  config touch): bump `web-version.txt`. `deploy-ota.yml` publishes
  automatically on push to `main`, gated on `latest.json`'s content
  changing — see `features/ota-updates.md`.
- **APK release** (new native plugin, manifest change, `capacitor.config.
  json` change): bump `versionCode` **and** `versionName` in `android/app/
  build.gradle`, then manually trigger `build-apk.yml`
  (`workflow_dispatch`).
- **Merge-order matters when two branches carry different `web-version.txt`
  values** — PR #48 and #49 both had to call this out explicitly in their
  bodies ("merge #49 first") because the OTA workflow publishes whatever
  version lands on `main`, and merging a lower version after a higher one
  would push installed apps a downgrade.

## Honest verification language

Every PR body in this project's history is explicit about **what was
actually verified** vs. what wasn't — usually a closing "Not verified on a
device" note, because the sandboxed dev environment these sessions ran in
cannot execute the native SQLite/WebView path. Follow this pattern exactly:
state build/lint/test results as build/lint/test results, and state
"verified in a headless-browser harness against the real component" as
distinct from "confirmed on a physical device." `history/status.md` and
several `history/findings.md` entries exist specifically because this
distinction was blurred once (a fix that "made a failure stop crashing" got
treated as if it had "made the operation succeed").

## Never without explicit, one-time permission

- Force-push.
- Skip hooks or bypass checks (`--no-verify`, etc.).
- `git reset --hard`, `checkout --`, `clean -f` without checking `git
  status` first and stashing/committing anything found.

## Secrets

- Never commit `.keystore`, `.jks`, `keystore.properties`, or `.env*` —
  already enforced by `.gitignore`; don't weaken it.
- The four Android signing secrets (`ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)
  live only in GitHub Actions secrets. `build-apk.yml` degrades to an
  unsigned build with a warning if they're absent, rather than failing —
  don't "fix" that by hardcoding a keystore path.
