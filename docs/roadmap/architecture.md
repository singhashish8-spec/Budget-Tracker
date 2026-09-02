# Architecture — the technical reference

> Adapted from `docs/repository-study.md` (written 2026-08-01 at web bundle
> 1.4.0 / versionCode 7, schema v13 — a structural study that was itself
> never merged to `main`; see `roadmap/decisions.md`). Updated 2026-08-15 to
> current state (web 1.7.0, same versionCode 7 / schema v13 — everything
> since 1.4.0 has shipped OTA-only, see the "Since 1.4.0" section below).
> This is a map, not a review — where the code carries a deliberate
> constraint, this doc records it, because most of the surprising choices
> here are load-bearing and easy to "clean up" into a regression.

## 1. Shape of the project

An India-focused personal finance tracker. One React codebase renders the
entire UI; a Capacitor Android shell wraps it and supplies the native
capabilities (SQLite, SMS inbox, biometrics, notifications, camera, print).
There is no server component — the app is offline-first and device-local.

| Layer | Location |
|---|---|
| Screens | `src/screens/` |
| Components | `src/components/` (+ `ui/` primitives) |
| State | `src/state/AppContext.jsx`, `selectors.js` |
| Persistence | `src/db/` (`sqlite.js`, `schema.js`, `repo.js`) |
| Services | `src/services/` |
| Native | `android/.../*.java` (plugins + activity) |

React 19, Vite 8, Capacitor 8.

### Dependency direction

```
screens/components  →  state (AppContext + selectors)  →  db/repo  →  db/sqlite
        │                                                              │
        └────────────────→  services  ─────────────────────────────────┘
                             (native bridges, parsing, export)
```

Screens do not talk to `repo` directly; they go through the context.
Selectors are pure functions over already-loaded arrays — no I/O.

## 2. Persistence

### `db/sqlite.js` — connection and migrations

Single lazily-created connection (`getDb()` memoizes a promise). On native
it is real SQLite; on web it is `jeep-sqlite` (sql.js/wasm over IndexedDB).
Web writes are not durable until `persist()` calls `saveToStore` — native
writes are immediate, so `persist()` is a no-op there.

Two safety mechanisms:

**Migrations are guarded against destruction.** `assertNonDestructive`
regex-scans every migration for `DROP TABLE` / `DELETE FROM` / `TRUNCATE` /
`DROP COLUMN` and throws before *any* statement runs, sweeping all
migrations up front specifically so the app can never partially apply a set
and then fail. Every migration v3→v13 is additive: `ADD COLUMN`,
`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX`.

**The database is deliberately unencrypted.** It previously used SQLCipher
keyed from the Android Keystore; an app update could lose that key,
permanently bricking the database — see `roadmap/decisions.md` and
`history/findings.md`. Protection now rests on the Android app sandbox; only
the JSON auto-backup ever leaves the device, never the raw database file.
`README.md` still lists "switch to encrypted mode before shipping" as a
known gap as of this writing — that's stale; the code has deliberately moved
the other way.

### `db/schema.js` — 13 migrations

Money is stored as **integer paise/rupee units, never floats** — see
`roadmap/decisions.md`. v1 core ledger → v2 reminders/goals/net-worth/SMS →
v3–v4 SMS provenance/timestamps → v5 budget periods → v7 EMI/subscription
bills → v9 warranty-months quick-tag → v10–v11 first-class warranties with
documents → v12 business/GST tagging + envelopes → v13 event budgets +
remembered CSV bank profiles.

v11 is the only migration that moves data: folds the old single
`warranties.photo` column into `warranty_documents` via `INSERT … SELECT`,
and **leaves the old column in place** — an older OTA bundle may still read
it (version skew, §5).

### `db/repo.js`

A flat, explicit data-access API. No ORM, no query builder. Bulk paths take
an `onProgress` callback for import UI.

## 3. State

`AppContext.jsx` is the largest file in the codebase — reducer, bootstrap,
every mutation action. Screens consume `useApp()`.

The bootstrap encodes hard-won failure handling. `App.jsx` renders one of
five outcomes: `loading` → `SkeletonHome`; `loadError` →
`DatabaseErrorScreen`; `locked` → `LockScreen`; `recoverable` →
`RecoveryScreen` (DB came up empty but a backup snapshot exists — offers the
data back instead of onboarding); otherwise the normal shell.

`DatabaseErrorScreen` carries an explicit correction: it used to offer
*only* "Reset & start fresh" (destructive), while the most common trigger is
a transient cold-start timeout. Retry is now primary; deletion is secondary,
confirmed, and warns plainly.

`selectors.js` holds dozens of pure derived-data functions — budget windows,
warranty status, duplicate detection, recurring-pattern detection, envelope
rollover, net-worth projection, spending forecast, subscription price-change
detection. All take `now = new Date()` as a defaulted parameter — injectable
and deterministic under test.

## 4. Services and the native bridge

The consistent convention: **every native call is wrapped so a missing
implementation degrades to a no-op**, never a throw — important because OTA
can push web code onto an APK whose native side is older (§5).

- **Native bridges** — `appIntegration.js`, `nativeTools.js` (bank/UPI
  notification capture, PDF export via `PrintManager`, add-to-calendar),
  `appLock.js` (biometric → device PIN/pattern fallback), `haptics.js`,
  `notify.js`, `clipboardCapture.js`.
- **Ingest** — `smsParse.js` (rewritten in PR #61 — see
  `features/sms-engine.md`), `smsReader.js`, `csvImport.js` (client-side,
  remembered per-bank column mapping — nothing sent to a third party),
  `quickAdd.js` (natural language: "spent 500 on food").
- **Export/backup** — `backup.js` (JSON + native share sheet), `autoBackup.js`
  (automatic snapshot on every data change — feeds `RecoveryScreen`),
  `zipExport.js`, `exportReport.js`, `errorLog.js` (added PR #49 — a capped
  `localStorage` ring buffer, deliberately *not* DB-backed, because the
  failures that matter most are the database failing to open or a migration
  throwing).
- **Presentation/updates** — `theme.js` (CSS-variable overrides, cached in
  `localStorage` for flash-free apply before first paint), `liveUpdate.js`.

### Android native

Java plugins for shared-file intake, shortcuts, secure-screen flag, and
bank/UPI notification listening. Manifest permissions are narrow —
`INTERNET`, `POST_NOTIFICATIONS`, `READ_SMS`, `RECEIVE_BOOT_COMPLETED`,
`SCHEDULE_EXACT_ALARM`, `VIBRATE`. `READ_SMS` plus the notification listener
is the app's most sensitive surface.

## 5. Release and OTA

Two mechanisms, and the distinction matters:

**`.github/workflows/build-apk.yml`** — manual (`workflow_dispatch`). Builds
and signs a release APK, publishes to GitHub Releases under a fixed asset
name. Signing gated on `HAS_KEYSTORE`; without the four keystore secrets it
builds unsigned with a warning rather than failing.

**`.github/workflows/deploy-ota.yml`** — automatic on any push to `main`
that touches the web layer. Commits `latest.json` + the versioned bundle zip
**to the root of `main`**, because Pages is configured "deploy from branch:
main /(root)" — see `roadmap/decisions.md`. Publication is gated on
`latest.json` changing, not zip bytes (also a decision — builds aren't
byte-reproducible).

`capacitor.config.json` sets `autoUpdate: false`: the app always boots a
bundle it already has, then checks the manifest in the background.

**The consequence to hold onto:** a web bundle can reach a device whose
native APK is older. That's exactly why services no-op on missing plugins
and why migrations never drop columns — both rules keep that skew
survivable.

Assets are bundled into the APK (no `server.url`) — a remotely-loaded page
bridged to SMS/camera/biometrics would bypass Play review of runtime
behavior and break offline use.

## 6. Security posture

- **No AI/cloud parsing** — removed entirely in PR #41 (`roadmap/decisions.md`).
- **No OAuth, no faked auth.** The original repository study (and the
  session-13 fix in `history/findings.md`) both claimed onboarding had a
  Google Sign-In button showing a "not configured" toast — checked against
  current code in Session 13 and that's **not what's there**: there's no
  sign-in step at all, and Google Drive backup works without OAuth (JSON
  export through the native share sheet — see `features/backup-restore.md`).
  The onboarding screen itself claimed "Your data is encrypted" until
  Session 13 fixed it — see `history/findings.md`.
- **CSV formula injection (CWE-1236)** guarded in `exportReport.js`
  (`csvCell`) — a value matching `/^[\s\xA0]*[=+\-@]/` (leading whitespace,
  BOM, non-breaking space included) is prefixed with a literal `'`.
- **Migration destruction guard**, as above.
- **Keystore never committed** — `.gitignore` excludes `*.keystore`,
  `*.jks`, `keystore.properties`, `.env*`, built APKs.

Open item: `.env.example`/README still describe a removed AI-scanning
feature with two mutually contradictory config approaches — see
`roadmap/decisions.md`.

## 7. Since 1.4.0 (what this doc's source didn't cover)

The original repository study was written at 1.4.0. Everything since has
shipped **OTA-only** — no native/`android/`/`capacitor.config.json` changes,
confirmed by `versionCode` still reading 7 as of 2026-08-15:

- **Five more visual skins** (Clay, Soft, Liquid Glass, Spatial, on top of
  the original Paper/Carbon/Glass/Neo/Serene — 9 total) behind a tiered
  "depth engine" — see `roadmap/decisions.md`.
- **`smsParse.js` rewritten** (PR #61) to stop conflating bill reminders
  with actual debits — see `features/sms-engine.md`.
- **The project's first automated test suite** — `src/services/
  smsParse.test.js`, 33 cases, run via `node --test`. Still the only test
  file in the repo as of 2026-08-15.
- **`errorLog.js`** — the on-device diagnostics ring buffer (§4).
- **The app-shell scroll architecture was structurally broken** (`min-height:
  100vh` instead of a bounded height) from an unknown point until PR #60
  fixed it — see `history/findings.md`.

## 8. Gaps (carried forward from the 2026-08-01 study, re-checked 2026-08-15)

- **No automated tests beyond the one SMS-parser suite above.** No test
  runner config beyond `node --test`; the two Android files under
  `androidTest/`/`test/` are untouched Capacitor scaffold. `selectors.js`'s
  dozens of pure functions with injectable clocks remain the highest-value,
  lowest-friction place to extend coverage.
- **`npm run lint` is oxlint only.** No type checking; `@types/react` is
  present but there is no TS or `checkJs`.
- **No CI on pull requests.** Both workflows are `workflow_dispatch` or
  push-to-`main` — nothing builds or lints a PR before merge. This is
  consistent with the pattern visible across nearly every PR body in
  `history/sessions/`: build+lint verified pre-merge, device behavior
  verified only *after*, via bug reports.
- **The AI-scanning story is still inconsistent** — confirmed still true
  2026-08-15. See `roadmap/decisions.md`.
- **`AppContext.jsx`** remains the single largest file and the one most
  likely to cause merge conflicts between parallel feature branches.

## 9. Working on this repo

- Money is integers. Don't introduce floats.
- Migrations are append-only and additive; never drop a column, even one
  that looks dead — an older OTA bundle may still read it.
- New native calls get a degrade-to-no-op wrapper.
- Derived logic belongs in `selectors.js` as a pure function taking `now`,
  not inline in a screen.
- After a web write, `persist()`; native is durable already.
- Bump `web-version.txt` for an OTA release; bump `versionCode`/
  `versionName` in `android/app/build.gradle` for an APK release.
- `npm install` needs `--legacy-peer-deps` (`capacitor-sms-inbox` pins an
  older `@capacitor/core` peer).
- `cap sync` requires Node ≥22.
- Whenever a change touches `setPointerCapture`/pointer-event handling on a
  row or surface that also has its own plain click/tap behaviour,
  explicitly re-test the plain-tap path too — see `history/findings.md`.
- For CSS cascade bugs, trust `getComputedStyle()` output over a re-read of
  the source — see `history/findings.md`.
