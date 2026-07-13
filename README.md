# Budget Tracker

India-focused personal finance tracker. Vite + React "frontend brain" wrapped
in a Capacitor native Android shell, backed by on-device SQLite. Ported from
the `Budget Tracker v2` design handoff — see that review's findings for why
some choices below (bundled assets, no client-side API keys, CSV escaping)
are deliberate deviations from the original prototype.

## Status: MVP core

Implemented: onboarding (accounts + categories), Home, Transactions, Budgets,
category picking, camera/file capture → AI-import → review screen, local
SQLite persistence with versioned migrations.

**Deferred** (not yet built): Insights, net worth, savings goals, 80C card,
bill reminders, smart patterns, SMS auto-tracking, Settings, multi-currency,
CSV/PDF export, Google Drive sync, and all of the "Master Production
Blueprint" custom features (dynamic pay-cycle, location tagging, NL chat
query, top-shelf pinning, recurring calendar engine, influx flowchart).

## Setup

```
npm install
npm run dev          # browser dev server (see caveat below)
npm run build         # production web build → dist/
npx cap sync android   # copy dist/ into the native project
```

Android build tooling isn't required to be on `PATH` — if `node`/`java`/`adb`
aren't found, they're likely already installed at their Windows defaults:
- Node: `C:\Program Files\nodejs`
- JDK: bundled with Android Studio at `...\Android Studio\jbr`
- SDK: `%LOCALAPPDATA%\Android\Sdk`

To build/run the Android app directly:
```
cd android
JAVA_HOME="<Android Studio>/jbr" ANDROID_HOME="<SDK path>" ./gradlew.bat assembleDebug
# APK lands at android/app/build/outputs/apk/debug/app-debug.apk
```
`android/local.properties` (gitignored) must contain `sdk.dir=<your SDK path>`.

### Browser dev-server SQLite caveat

`npm run dev` uses `jeep-sqlite` (sql.js/wasm via IndexedDB) as a browser
stand-in for real SQLite so screens can be iterated on without a device. This
is dev-only — native Android never touches it, it talks to real SQLite
directly. If the web fallback hangs on the loading spinner in a *sandboxed or
headless* browser context (Workers/wasm restricted), it now fails after 10s
with a visible error rather than hanging forever (`src/db/sqlite.js`); it has
not been confirmed to work in a normal desktop browser yet — verify on your
own machine before relying on it for iteration.

## Configuring the placeholders

Two integrations are stubbed out on purpose rather than faked:

- **Google Sign-In / Drive sync** — the onboarding sign-in button shows a
  "not configured" toast instead of a fake success state. Wire real OAuth +
  `drive.appdata` scope sync before shipping; do not simulate success.
- **AI receipt/statement parsing** (`src/services/aiExtract.js`) — posts to
  `VITE_AI_PARSE_ENDPOINT`, a backend endpoint *you* control. It deliberately
  never calls Claude/Gemini directly from the client: an API key shipped
  inside the APK is extractable by anyone who downloads it. Stand up a small
  backend that holds the real key and forwards to the LLM using the contract
  documented at the top of that file, then set:
  ```
  # .env.local (gitignored)
  VITE_AI_PARSE_ENDPOINT=https://your-backend.example.com/parse
  ```

## Architecture notes carried over from the design review

- **Assets are bundled into the APK at build time** (`capacitor.config.json`
  has no `server.url`). The original blueprint's "Global Hosting" plan
  (Netlify/Vercel serving the live shell content) was rejected: a remotely
  loaded page with a bridge to SMS/camera/biometrics bypasses Play Store
  review of what the app actually does at runtime, and breaks offline use.
  Ship UI updates through the Play Store like a normal app.
- **No API keys in the client** — see AI parsing above.
- **SQLite is not yet encrypted at rest.** `src/db/sqlite.js` opens the
  native connection with `'no-encryption'`. Before shipping, switch to the
  plugin's encrypted mode (SQLCipher-backed) and gate it behind the app-lock
  biometric prompt — this is a known gap, not an oversight.
- **CSV/formula injection**: not built yet (export is deferred), but when it
  is, merchant/date strings originating from AI-extracted, attacker-
  influenceable file content must be prefixed with `'` if they start with
  `=+-@` before quoting — quoting alone does not stop Excel from treating a
  leading `=` as a formula.

## Play Store launch (corrections to the original roadmap PDF)

- Closed testing requires **12 testers for 14 continuous days** (not 20) as
  part of the personal-developer-account production-access requirement.
- Two mandatory gating steps were missing from the original milestone list:
  the **Data Safety form** (required given SMS + camera + location-adjacent
  data collection) and a **privacy policy URL**.
- Ongoing LLM API costs (per receipt/statement/chat parse) aren't $0 past
  free-tier quotas — budget this separately from the one-time console fee.
