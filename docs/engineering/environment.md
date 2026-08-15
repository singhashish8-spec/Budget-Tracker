# Environment, local setup, secrets

> Kept current — edit in place when setup steps change. As of 2026-08-15.

## Local setup

```
npm install --legacy-peer-deps   # capacitor-sms-inbox pins an older @capacitor/core peer
npm run dev                      # Vite dev server, web preview only
npm run build                    # production web build
npm run lint                     # oxlint
npm test                         # node --test 'src/**/*.test.js' — currently just smsParse.test.js
```

Node **≥22** is required for `cap sync` (the Capacitor CLI's own
requirement) — the web build itself runs on Node 20, but don't rely on that
if you're also touching `android/`.

**The web dev preview cannot exercise the native SQLite path.** `jeep-sqlite`
(sql.js/WASM over IndexedDB) stands in for real SQLite on web, but several
things below it — the native `@capacitor-community/sqlite` driver, the
Filesystem plugin, biometric auth, SMS/notification capture, haptics — are
stubbed or absent entirely in a browser. This is why nearly every PR in this
project's history closes with an honest "not verified on a device" note —
see `engineering/git-workflow.md`. Don't treat a clean `npm run build` +
browser click-through as equivalent to on-device verification.

## Environment variables

- **`.env.example`** currently documents `VITE_GEMINI_API_KEY` for AI
  receipt/statement scanning — **this is stale.** The AI-scanning feature
  was removed entirely in PR #41 (2026-07-26); no code in `src/` reads this
  variable. See `roadmap/decisions.md` for the open question of whether to
  delete this file's content or replace it with a "not yet built" backend-
  proxy note. Don't copy `.env.example` into `.env.local` expecting it to
  do anything as of 2026-08-15 — it won't.
- **`VITE_APP_VERSION`** — the only environment variable actually read
  anywhere in `src/`, injected at build time from `web-version.txt`, shown
  in Settings → About.

## Secrets (CI only, never local)

Android APK signing needs four GitHub Actions secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` — the keystore must be the
**same** one that signed the currently-installed app, or a new build won't
install as an update. `build-apk.yml` builds unsigned (with a warning)
rather than failing if these are unset. None of this is needed for local
web development.

## Android build

`android/` is a standard Capacitor project. `npx cap sync android` should
register all Capacitor plugins currently in `package.json` — see
`engineering/tech-stack.md` for the list. Building the APK itself (Gradle)
was, throughout this project's history, only ever done in CI
(`build-apk.yml`) — the recovered PR history repeatedly notes that Java/
Gradle changes were "compiled for the first time by CI," not locally, so
treat a local Gradle build as unverified until proven otherwise in your own
environment.
