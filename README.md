# Budget Tracker

India-focused personal finance tracker. Vite + React "frontend brain" wrapped
in a Capacitor native Android shell, backed by on-device SQLite. Ported from
the `Budget Tracker v2` design handoff — see that review's findings for why
some choices below (bundled assets, no client-side API keys, CSV escaping)
are deliberate deviations from the original prototype.

> **New to this project, or picking it back up after a break?** Read
> [`docs/README.md`](docs/README.md) first, then `docs/history/status.md` —
> the structured documentation system (current state, decision log, full
> session-by-session history, feature docs) that replaced the old single-file
> `docs/PROJECT_HISTORY.md` on 2026-08-15. That file is kept only as a frozen
> legacy reference.

## Status

> This section used to describe an early MVP snapshot and had drifted badly
> out of date — most of what it once listed as "deferred" has since shipped.
> See `docs/history/status.md` for the always-current version of this.

Live as of web bundle 1.7.0 / native APK versionCode 7: onboarding, Home,
Transactions, Budgets (calendar/pay-cycle/envelope), Insights, net worth
(with manually-priced holdings), savings goals, event budgets, bill/EMI/
subscription reminders with progress tracking, a first-class Warranty
tracker, SMS auto-tracking (bank/UPI SMS + notification capture) with a
rule-based parsing engine, smart-pattern detection, CSV import, JSON/ZIP
backup and restore with automatic on-device snapshots, side-hustle/GST
tagging, and 9 visual themes ("skins"). Local SQLite persistence with
versioned migrations (schema v13). See `docs/roadmap/architecture.md` for
the technical shape and `docs/features/` for individual feature writeups.

**Removed** (was built, then deliberately taken out): AI/cloud receipt and
bank-statement parsing — see `docs/roadmap/decisions.md` for why.

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

## No environment variables needed

`.env.example` documented an AI-parsing API key here for a while — that
feature was removed (see below), so as of now the app needs **zero**
environment variables to build or run. `VITE_APP_VERSION` (shown in
Settings → About) is injected automatically at build time from
`web-version.txt`, not something you configure.

Google Drive backup doesn't need OAuth or any client configuration either —
it serializes your data to a JSON file and opens the native Android share
sheet, where "Save to Drive" is one tap. See `docs/features/backup-restore.md`.

## Architecture notes carried over from the design review

- **Assets are bundled into the APK at build time** (`capacitor.config.json`
  has no `server.url`). The original blueprint's "Global Hosting" plan
  (Netlify/Vercel serving the live shell content) was rejected: a remotely
  loaded page with a bridge to SMS/camera/biometrics bypasses Play Store
  review of what the app actually does at runtime, and breaks offline use.
  Ship UI updates through the Play Store like a normal app.
- **No API keys in the client** — the app calls no third-party service at
  all; see "Removed" above.
- **SQLite is deliberately unencrypted**, not "not yet" encrypted — this
  reverses what an earlier version of this README said. It used to be
  encrypted (SQLCipher, keyed from the Android Keystore); that key could be
  lost across an app update, permanently bricking the database. It was
  removed on purpose (`src/db/sqlite.js` opens with `'no-encryption'`) —
  protection now rests on the Android app sandbox, and only the JSON backup
  ever leaves the device, never the raw database file. See
  `docs/roadmap/decisions.md`.
- **CSV/formula injection (CWE-1236) is guarded**, not deferred — `csvCell()`
  in `src/services/exportReport.js` prefixes a value with `'` if it starts
  with `=+-@` (including after leading whitespace/BOM/non-breaking space)
  before quoting, since quoting alone doesn't stop a spreadsheet app from
  treating a leading `=` as a formula.

## Play Store launch (corrections to the original roadmap PDF)

- Closed testing requires **12 testers for 14 continuous days** (not 20) as
  part of the personal-developer-account production-access requirement.
- Two mandatory gating steps were missing from the original milestone list:
  the **Data Safety form** (required given SMS + camera + location-adjacent
  data collection) and a **privacy policy URL**.
- ~~Ongoing LLM API costs (per receipt/statement/chat parse) aren't $0 past
  free-tier quotas~~ — moot now that AI parsing has been removed entirely.
