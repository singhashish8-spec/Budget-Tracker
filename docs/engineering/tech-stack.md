# Tech stack

> Kept current — edit in place when a dependency or tool changes. As of
> 2026-08-15.

## Core

- **React 19** + **Vite 8** — the entire UI, one codebase for web preview
  and the native app.
- **Capacitor 8** — the native shell. `@capacitor/android`, `@capacitor/
  core`, `@capacitor/cli`.
- **SQLite** — `@capacitor-community/sqlite` on native; `jeep-sqlite`
  (`sql.js` 1.11.0 over IndexedDB/WASM) on web, so screens can be iterated
  on in a browser. `sql.js` is **pinned** to 1.11.0 — a newer version broke
  compatibility with `jeep-sqlite` and crashed the app on init (see
  `history/findings.md` for the PR #38 writeup); don't bump it without
  re-verifying against `jeep-sqlite`'s expected version.

## Native plugins

`@aparajita/capacitor-biometric-auth`, `@capacitor/camera`, `@capacitor/
clipboard`, `@capacitor/filesystem`, `@capacitor/haptics`, `@capacitor/
local-notifications`, `@capacitor/share`, `@capgo/capacitor-updater` (the
OTA mechanism — see `features/ota-updates.md`), `capacitor-sms-inbox`.

**`capacitor-sms-inbox` pins an older `@capacitor/core` peer** — `npm
install` needs `--legacy-peer-deps` because of this. Both CI workflows
already do this; don't drop it locally either.

## Build/lint/test

- **`npm run build`** — `vite build`.
- **`npm run lint`** — **oxlint only**. No type checking; `@types/react`
  and `@types/react-dom` are present as dev dependencies but there is no
  actual TypeScript or `checkJs` in the build.
- **`npm test`** — `node --test 'src/**/*.test.js'`. As of 2026-08-15 the
  only file matching that glob is `src/services/smsParse.test.js` (33
  cases) — see `features/sms-engine.md`. No other test runner or framework
  is configured.
- **No CI runs on pull requests.** Both GitHub Actions workflows
  (`build-apk.yml`, `deploy-ota.yml`) are `workflow_dispatch` or
  push-to-`main` triggered — see `engineering/git-workflow.md` and
  `roadmap/architecture.md` §8.

## Other libraries

- **`fflate`** — ZIP creation for the export feature (`features/
  backup-restore.md`).
- **`archiver`** (dev dependency) — used by the release-web script, not the
  app itself; forward-slash paths in the zip, since Android's unzipper
  requires them.

## Requirements to build

- **Node ≥22** for `cap sync` (the Capacitor CLI's own requirement). The web
  build itself works on Node 20 — the OTA workflow pins 20 because it only
  builds the web layer; the APK workflow uses 22 because it also runs `cap
  sync`.
- `npm install --legacy-peer-deps` (see above).
