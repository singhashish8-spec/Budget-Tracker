# Repository study — Budget Tracker

A structural walkthrough of this codebase: what the layers are, how data moves
through them, which invariants the code is deliberately protecting, and where
the known gaps sit. Written from the tree at web bundle **1.4.0** /
`versionCode 7`, schema **v13**.

This is a map, not a review. Where the code carries a deliberate constraint the
study records it, because most of the surprising choices here are load-bearing
and easy to "clean up" into a regression.

---

## 1. Shape of the project

An India-focused personal finance tracker. One React codebase renders the
entire UI; a Capacitor Android shell wraps it and supplies the native
capabilities (SQLite, SMS inbox, biometrics, notifications, camera, print).
There is no server component — the app is offline-first and device-local.

| Layer | Location | Size |
|---|---|---|
| Screens | `src/screens/` (15) | ~3.9k lines |
| Components | `src/components/` (20 + 11 `ui/` primitives) | ~2.5k lines |
| State | `src/state/AppContext.jsx`, `selectors.js` | ~2.7k lines |
| Persistence | `src/db/` (`sqlite.js`, `schema.js`, `repo.js`) | ~1.4k lines |
| Services | `src/services/` (18 modules) | ~1.5k lines |
| Native | `android/.../*.java` (3 plugins + activity) | — |

~14.2k lines across 75 JS/JSX/CSS files. Dependencies are current: React 19,
Vite 8, Capacitor 8.

### Dependency direction

```
screens/components  →  state (AppContext + selectors)  →  db/repo  →  db/sqlite
        │                                                              │
        └────────────────→  services  ─────────────────────────────────┘
                             (native bridges, parsing, export)
```

Screens do not talk to `repo` directly; they go through the context. Selectors
are pure functions over already-loaded arrays — no I/O — which is what makes
the whole derived layer trivially testable, if tests are ever added.

---

## 2. Persistence

### `db/sqlite.js` — connection and migrations

Single lazily-created connection (`getDb()` memoizes a promise). On native it
is real SQLite; on web it is `jeep-sqlite` (sql.js/wasm over IndexedDB) so
screens can be iterated on in a browser. Web writes are not durable until
`persist()` calls `saveToStore` — native writes are immediate, so `persist()`
is a no-op there.

Two safety mechanisms are worth knowing before touching this file:

**Migrations are guarded against destruction.** `assertNonDestructive` regex-
scans every migration for `DROP TABLE` / `DELETE FROM` / `TRUNCATE` /
`DROP COLUMN` and throws before *any* statement runs. The check sweeps all
migrations up front specifically so the app can never partially apply a set and
then fail. Every migration v3→v13 is consequently additive: `ADD COLUMN`,
`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX`.

**The database is deliberately unencrypted.** It previously used SQLCipher
keyed from the Android Keystore; an app update could lose that key, rendering
the database permanently unreadable and dumping every user into recovery. The
header comment records this. Protection now rests on the Android app sandbox,
and the only thing that ever leaves the device is the JSON auto-backup — never
the raw database file. A leftover encrypted file from an older build fails to
open in plaintext mode; that error is allowed to propagate so the bootstrap can
rebuild and restore from backup.

> Note the tension with `README.md`, which still lists "switch to encrypted
> mode before shipping" as a known gap. The code has since moved the other way
> on purpose. The README is stale on this point.

### `db/schema.js` — 13 migrations

Money is stored as **INTEGER paise/rupee units**, never floats. Growth is
legible from the migration list: v1 core ledger → v2 reminders/goals/net-worth/
SMS → v3–v4 SMS provenance and real `occurred_at` timestamps → v5 budget
periods → v7 EMI/subscription bills → v10–v11 first-class warranties with
documents and claims → v12 business/GST tagging plus zero-based envelopes →
v13 event budgets and remembered CSV bank profiles.

The v11 migration is the only one that moves data: it folds the old single
`warranties.photo` column into the new `warranty_documents` table via
`INSERT … SELECT`, and leaves the column in place so older bundles reading the
same database don't break. That "leave the old column behind" habit matters
because of OTA — see §5.

### `db/repo.js` — 68 exported functions

A flat, explicit data-access API (`listTransactions`, `addTransaction`,
`upsertBudget`, `setEnvelope`, …). No ORM, no query builder. Bulk paths
(`addTransactions`, `deleteTransactions`) take an `onProgress` callback so
imports can drive a progress UI.

---

## 3. State

`AppContext.jsx` is the single largest file (1,766 lines) and the app's
centre of gravity: reducer, bootstrap, and every mutation action. Screens
consume `useApp()`.

The bootstrap is the interesting part, because it encodes hard-won failure
handling. `App.jsx` renders one of five outcomes:

1. `loading` → `SkeletonHome`
2. `loadError` → `DatabaseErrorScreen`
3. `locked` → `LockScreen` (biometric app lock)
4. `recoverable` → `RecoveryScreen` — the database came up empty but a backup
   snapshot exists, so the app offers the data back instead of marching the
   user through onboarding on top of their own records
5. otherwise → the normal shell

`DatabaseErrorScreen` carries an explicit design correction in its comment: it
used to offer *only* "Reset & start fresh", which deletes the database — while
the most common trigger is a transient cold-start timeout. Retry is now
primary; deletion is secondary, confirmed, and warns in plain language. The
`looksTransient` regex tailors the copy. This is the kind of thing to preserve
rather than simplify.

Related tuning: the `jeep-sqlite` init timeout in `sqlite.js` was raised 10s →
25s because cold `npm run dev` starts were tripping it and landing developers
on the error screen for no reason. `RESTORE_TIMEOUT_MS` is 45s.

`selectors.js` holds 32 pure derived-data functions — budget windows (calendar
month vs payday cycle vs custom), warranty status, duplicate detection,
recurring-pattern detection, envelope rollover, net-worth projection, spending
forecast, subscription price-change detection. All take `now = new Date()` as a
defaulted parameter, so they are injectable and deterministic under test.

---

## 4. Services and the native bridge

Eighteen modules in `src/services/`. The consistent convention: **every native
call is wrapped so a missing implementation degrades to a no-op**, never a
throw. That covers the web build and older APKs that predate a given plugin —
important because OTA can push web code onto an APK whose native side is older
(§5).

Grouped by job:

- **Native bridges** — `appIntegration.js`, `nativeTools.js` (bank/UPI
  notification capture, PDF export via `PrintManager`, add-to-calendar),
  `appLock.js` (biometric, falling back to device PIN/pattern),
  `haptics.js`, `notify.js`, `clipboardCapture.js`.
- **Ingest** — `smsParse.js` (parses Indian bank/UPI SMS; accepts `₹`, `Rs`,
  `INR`), `smsReader.js` (reads the inbox, de-duplicates the one-payment-two-
  messages case), `csvImport.js` (client-side parser + remembered per-bank
  column mapping — nothing is sent to a third party), `quickAdd.js` (natural
  language: "spent 500 on food").
- **Export/backup** — `backup.js` (JSON + native share sheet, so "Save to
  Drive" is one tap without OAuth), `autoBackup.js` (automatic snapshot on
  every data change — this is what feeds `RecoveryScreen`), `zipExport.js`,
  `exportReport.js`.
- **Presentation/updates** — `theme.js` (CSS-variable overrides, cached in
  `localStorage` so the theme applies before React renders and avoids a flash
  of the wrong one), `liveUpdate.js`.

`haptics.js` has a nice piece of restraint in its header: the temptation is to
buzz on every tap, iOS deliberately doesn't, so feedback is tiered.

### Android native

Three Java plugins: `AppIntegrationPlugin`, `NativeToolsPlugin`, and
`BankNotificationListenerService`. Manifest permissions are narrow —
`INTERNET`, `POST_NOTIFICATIONS`, `READ_SMS`, `RECEIVE_BOOT_COMPLETED`,
`SCHEDULE_EXACT_ALARM`, `VIBRATE`.

`READ_SMS` plus the notification listener is the app's most sensitive surface
and the reason the Play Store Data Safety form is called out as a mandatory
gate in the README.

---

## 5. Release and OTA

Two mechanisms ship changes, and the distinction matters:

**`.github/workflows/build-apk.yml`** — manual (`workflow_dispatch`). Builds
and signs a release APK in the cloud, publishes to GitHub Releases under the
fixed asset name `BudgetTracker.apk` so the "latest" download link is stable.
Signing is gated on `HAS_KEYSTORE`; without the four keystore secrets it builds
unsigned and emits a `::warning::` rather than failing. Requires the *same*
keystore that signed the installed app or updates won't install over it.

**`.github/workflows/deploy-ota.yml`** — automatic on any push to `main` that
touches the web layer. Builds the bundle and commits `latest.json` plus
`budget-tracker-web-<version>.zip` **to the root of `main`**, because Pages is
configured as "deploy from branch: main /(root)". Publication is gated on
`latest.json` changing — builds aren't byte-reproducible, so gating on the zip
bytes would commit an identical bundle every run. Old zips are `git rm`'d so
only the current version is served.

`capacitor.config.json` sets `autoUpdate: false`: the app always boots a bundle
it already has (offline works), then checks the manifest in the background.

**The consequence to hold onto:** a web bundle can reach a device whose native
APK is older. That is exactly why services no-op on missing plugins and why
migrations never drop columns. Both rules exist to keep that skew survivable.

The automated OTA commits also explain the shape of `git log` — `Publish web
bundle X (automated)` alternating with feature commits, and the occasional
`Merge remote-tracking branch 'origin/main'` where a local push raced the bot.

Assets are bundled into the APK (no `server.url`). The README records the
reasoning: a remotely-loaded page bridged to SMS/camera/biometrics would bypass
Play review of what the app actually does at runtime, and would break offline
use.

---

## 6. Security posture

Handled deliberately:

- **No API keys in the client** — stated as a principle, but the repo now
  contradicts itself on it. See §7.1; this needs a decision, not just a doc
  edit.
- **No faked auth.** Google Sign-In shows a "not configured" toast rather than
  simulating success.
- **CSV formula injection (CWE-1236)** is guarded in `exportReport.js:13`
  (`csvCell`). A value matching `/^[\s﻿\xA0]*[=+\-@]/` — leading
  whitespace, BOM and non-breaking space included, so the check can't be
  stepped around — is prefixed with a literal `'` before quoting, because
  quoting alone does not stop Excel treating a leading `=` as a formula.
- **Migration destruction guard**, as above.
- **Keystore never committed** — `.gitignore` excludes `*.keystore`, `*.jks`,
  `keystore.properties`, `.env*`, and built APKs.

Open items: the database is unencrypted (deliberate, §2), and `READ_SMS` +
notification listening remain the widest data surface.

---

## 7. Gaps

### 7.1 The AI-scanning story is inconsistent three ways

Worth resolving first, because two of the three accounts give opposite
security advice and a reader can't tell which is current.

| Source | Says |
|---|---|
| `README.md` | Post to `VITE_AI_PARSE_ENDPOINT`, a backend *you* control. Explicitly: never call Gemini/Claude from the client, because a key in the APK is extractable. |
| `.env.example` | Set `VITE_GEMINI_API_KEY`. Concedes the key "is baked into the APK at build time and is extractable", advising a rotatable key and "don't publish the APK". |
| The code | Neither variable is referenced. The only env var read anywhere in `src/` is `VITE_APP_VERSION`. `src/services/aiExtract.js` does not exist. |

So the feature is absent, and the two config documents recommend opposite
architectures — one of which the README elsewhere rejects by name. Nothing is
leaking today (an unread variable is never bundled), but `.env.example` is the
file a newcomer opens first, and it currently walks them into the pattern the
project decided against. It also implies AI scanning works, when the actual
ingest paths are the local, no-network `csvImport.js` and `smsParse.js`.

Pick one: delete `.env.example` and the README's "Configuring the
placeholders" section as dead weight, or keep the backend-proxy plan
documented as *not yet built* and drop the Gemini key file. Either way the
`VITE_GEMINI_API_KEY` guidance should go.

### 7.2 Everything else

- **No automated tests anywhere.** No test files, no test runner in
  `package.json`; the two Android files under `androidTest/` and `test/` are
  the untouched Capacitor scaffold. `selectors.js` is 32 pure functions with
  injectable clocks — budget-window maths, warranty expiry, duplicate
  detection, envelope rollover — and is the highest-value, lowest-friction
  place to start.
- **`npm run lint` is oxlint only**, configured by a 231-byte `.oxlintrc.json`.
  No type checking; `@types/react` is present but there is no TS or `checkJs`.
- **No CI on pull requests.** Both workflows are `workflow_dispatch` or
  push-to-`main`, so nothing builds or lints a PR before merge.
- **README drift — three separate places.** (a) The "Status: MVP core" section
  lists Insights, goals, bill reminders, SMS auto-tracking, Settings, CSV
  export and patterns as *deferred*; all of them now exist as screens. (b) The
  encryption note says "switch to encrypted mode before shipping" while the
  code has deliberately moved the other way (§2). (c) The "Configuring the
  placeholders" section documents a file that isn't in the tree — §7.1.
- **`AppContext.jsx` at 1,766 lines** mixes reducer, bootstrap, and every
  mutation. It is coherent but is the file most likely to cause merge conflicts
  between parallel feature branches.

---

## 8. Working on this repo

- Money is integers. Don't introduce floats.
- Migrations are append-only and additive; never drop a column, even one that
  looks dead — an older OTA bundle may still read it.
- New native calls get a degrade-to-no-op wrapper.
- Derived logic belongs in `selectors.js` as a pure function taking `now`, not
  inline in a screen.
- After a web write, `persist()`; native is durable already.
- Bump `web-version.txt` for an OTA release; bump `versionCode`/`versionName`
  in `android/app/build.gradle` for an APK release.
- `npm install` needs `--legacy-peer-deps` (`capacitor-sms-inbox` pins an older
  `@capacitor/core` peer). Both workflows do this.
- `cap sync` requires Node ≥22. The APK workflow uses 22; the OTA workflow
  pins 20, which is fine because it only builds the web layer.
