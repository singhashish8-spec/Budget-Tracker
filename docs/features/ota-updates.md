# Feature: OTA update pipeline

> Part of `features/`. Status: **built**, **root-caused once** (PRs #1–3).
> See `roadmap/architecture.md` §5 for the technical mechanics and
> `roadmap/decisions.md` for the underlying decisions.

## Summary

The web layer (React app bundle) updates over the air via `@capgo/
capacitor-updater`, independent of the native APK. A GitHub Actions workflow
builds and publishes a `latest.json` manifest + versioned bundle zip on
every push to `main` that touches the web layer; the app checks that
manifest, downloads a newer bundle if one exists, and swaps to it — all
without an app-store update.

## Why this exists

Native Android releases (Play Store or sideloaded APK) are slow and heavy —
this project's actual APK release cadence is roughly one build per several
weeks (`versionCode` has moved 3→4→5→6→7 across the entire recovered
history, vs. 62 PRs and a web version climbing from 1.0.9 to 1.7.0 in the
same window). OTA lets the vast majority of changes — anything that's pure
JS/CSS, no new native plugin — reach users same-day.

## What's built

- **`.github/workflows/deploy-ota.yml`** — builds the web layer and commits
  `latest.json` + `budget-tracker-web-<version>.zip` to the **root of
  `main`**, gated on `latest.json`'s content (driven by `web-version.txt`)
  changing, not the zip's bytes.
- **`liveUpdate.js`** — `updatesSupported`, `fetchManifest`,
  `getCurrentVersion`, `downloadUpdate(onProgress)`,
  `applyUpdateAndReload`. Manual "Check for updates" in Settings shows a
  real download progress bar and a "Restart to finish" flow (PR #27).
- **`capacitor.config.json` sets `autoUpdate: false`** — the app always
  boots a bundle it already has (offline-safe), then checks the manifest in
  the background, rather than blocking startup on a network check.
- Old bundle zips are `git rm`'d on each publish so only the current
  version is served.

## The bug that took three PRs to actually fix (see `history/sessions/
2026-07-21-session-05.md` and `roadmap/decisions.md`)

The mechanism from Session 03 (`@capgo/capacitor-updater` wired up
2026-07-19) **never actually worked in production** — the manifest URL
404'd, confirmed on-device, so every "shipped" release from 1.0.4 onward was
never delivered; only the bundle baked into the APK ever ran. Fixing it took
three PRs, each correcting the previous one's wrong assumption:

1. **PR #1** — assumed the repo used GitHub Actions—based Pages deployment;
   built a workflow around that.
2. **PR #2** — discovered on-device that this repo's Pages is actually
   configured as "deploy from branch: main /(root)," which silently ignores
   Actions-based deploys; switched to committing files straight to `main`
   root.
3. **PR #3** — the fix from #2 caused a new problem: since builds aren't
   byte-reproducible, every push looked like a "changed" bundle and
   republished. Gated on `latest.json` content instead.

## Open questions

- No item currently open specific to this feature as of 2026-08-15 — the
  mechanism has been stable since PR #3 (2026-07-21). Any future change to
  Pages configuration or the build pipeline should be re-verified on-device
  the same way #2 was, given how silently the original failure mode (a
  404'ing manifest) went unnoticed.
