# Budget Tracker — Project History & Guide

> **This is the one file to read to catch up on this project.** If you are a
> human returning after a break, or an AI assistant starting a brand-new chat
> session with no memory of previous conversations, read this file top to
> bottom before doing anything else. It explains what the app is, how it is
> built, everything that has happened to it version by version, every
> significant bug and how it was fixed, what is shipped right now, and what is
> still left to do.
>
> **Keeping it current:** whenever a new batch of work ships (a new version,
> a fixed bug, a new feature), add an entry to this file in the same session,
> before moving on. This file is only useful if it stays true.
>
> Last updated: **2026-08-02**, at web bundle **1.5.5** / native APK
> **v1.4 (build 7)**, database schema **v13**.

---

## Table of contents

1. [What this app is, in plain English](#1-what-this-app-is-in-plain-english)
2. [How it's built — the technical shape](#2-how-its-built--the-technical-shape)
3. [The look of the app — themes ("skins")](#3-the-look-of-the-app--themes-skins)
4. [How updates reach the phone — OTA vs APK](#4-how-updates-reach-the-phone--ota-vs-apk)
5. [Complete version history](#5-complete-version-history)
6. [Notable bugs and how they were found and fixed](#6-notable-bugs-and-how-they-were-found-and-fixed)
7. [Where things stand right now](#7-where-things-stand-right-now)
8. [What's still pending / open](#8-whats-still-pending--open)
9. [Rules of the road — conventions for changing this codebase](#9-rules-of-the-road--conventions-for-changing-this-codebase)
10. [Glossary](#10-glossary)

---

## 1. What this app is, in plain English

**Budget Tracker** is a personal finance app for people in India. It runs on
an Android phone. Its whole job is to answer, at a glance: *how much have I
spent, on what, and how does that compare to what I meant to spend?*

It does this without you having to type in every purchase by hand:

- **It reads your bank/UPI text messages.** In India, almost every card swipe,
  UPI payment or bank debit/credit sends you an SMS ("Rs.450 debited from A/c
  ...for UPI/... at Swiggy"). The app scans those messages (with your
  permission), figures out the amount, the merchant, and whether it was money
  in or money out, and quietly turns each one into a transaction — no manual
  entry needed. This is the app's main trick, and almost everything else is
  built on top of it.
- **It sorts spending into categories** (Food, Transport, Groceries, Bills,
  etc.) — either automatically (once you've told it "payments to Swiggy are
  Food," it remembers), or by tapping a transaction and picking one.
- **It tracks budgets** against a real pay cycle (payday-to-payday, not just
  the calendar month, since most people's spending resets when they get paid,
  not on the 1st).
  - It also has weekly/monthly caps, one-off event budgets (e.g. "Diwali
    shopping: ₹15,000"), and zero-based envelope budgeting for people who want
    to plan every rupee.
- **It tracks bills, EMIs and subscriptions** — loan instalments, recurring
  payments — with progress bars showing how much of a loan is paid off, and
  warns you before a subscription renews.
- **It tracks warranties** — photograph a receipt/warranty card, and the app
  reminds you before it expires and lets you file a claim.
- **It sets savings goals** and shows how close you are to hitting them, and
  whether you're on pace.
- **It projects your net worth** and forecasts near-future spending based on
  your patterns.
- **It backs itself up automatically** to a file on your phone (and lets you
  export/share that file, e.g. to Google Drive) so a phone swap or app
  reinstall doesn't lose your history.
- **It never sends your data to a server.** There is no backend. Everything —
  every transaction, every SMS scan, every budget calculation — happens on
  your phone, in a local database. Nothing about your spending is uploaded
  anywhere. (The one-time AI receipt-scanning feature that *would* have
  needed a server was removed early on — see [§5](#5-complete-version-history)
  — specifically because doing it safely would have meant either running a
  backend server or shipping a secret API key inside the app where anyone
  could extract it. Rather than accept either tradeoff, that feature was cut.)

**Who builds it, and how:** the app is built almost entirely through
conversations with AI coding assistants (Claude, and earlier some work by
Google's "Jules") — the owner describes what they want in plain language, the
assistant designs it, writes the code, tests it, and ships it. This file is
the record of that whole process.

**How you get updates:** most updates arrive silently, in the background,
without you ever visiting an app store — see [§4](#4-how-updates-reach-the-phone--ota-vs-apk).
Occasionally a deeper update (one that needs a new permission, or changes
something only the app store version of Android code can change) requires
installing a new APK file by hand.

---

## 2. How it's built — the technical shape

*(This section assumes some technical background. If you're not technical,
feel free to skip to [§3](#3-the-look-of-the-app--themes-skins).)*

### Stack

- **Frontend:** React 19, built with Vite 8.
- **Native shell:** Capacitor 8 — wraps the web app in a real Android app and
  exposes native device features (SQLite, SMS inbox, camera, biometrics,
  notifications, print, share sheet) to the web code as JavaScript APIs.
- **Database:** SQLite, entirely on-device. No server, no cloud database,
  no user accounts. On a real phone this is the native SQLite plugin
  (`@capacitor-community/sqlite`); in a browser (for development only) it
  falls back to `jeep-sqlite`, a WASM build of SQLite running over
  IndexedDB, so screens can be built and tested without an Android device.
- **Money is stored as integers** (paise/whole rupees), never as floating
  point numbers — this avoids the classic "0.1 + 0.2 ≠ 0.3" rounding bugs
  that plague naive financial software.

### Size, as of this writing

| Layer | Location | Rough size |
|---|---|---|
| Screens | `src/screens/` | 14 screens |
| Components | `src/components/` + `src/components/ui/` | 20 + 11 shared primitives |
| State | `src/state/AppContext.jsx`, `src/state/selectors.js` | ~2.7k lines |
| Persistence | `src/db/` (`sqlite.js`, `schema.js`, `repo.js`) | ~1.4k lines |
| Services (native bridges, parsing, export) | `src/services/` | 19 modules |
| Native (Android) | `android/.../*.java` | 3 custom plugins + activity |
| **Total** | | **~16,200 lines** across 79 JS/JSX/CSS files |

### How data flows

```
screens/components  →  state (AppContext + selectors)  →  db/repo  →  db/sqlite
        │                                                              │
        └────────────────→  services  ─────────────────────────────────┘
                             (native bridges, parsing, export)
```

Screens never talk to the database layer (`db/repo`) directly — everything
goes through `AppContext`, a single React context that holds all app state
and every mutation ("add a transaction," "delete a category," etc.) as a
function. `selectors.js` holds ~32 pure functions that compute derived
values (this month's spend, budget status, net worth, forecasts) from the
already-loaded data — no I/O, so they're straightforward to test in
isolation (nothing does yet — see [§8](#8-whats-still-pending--open)).

### The database

- **Migrations are append-only.** The schema has gone through 13 versions
  (`src/db/schema.js`), and every single one only *adds* — new columns, new
  tables, new indexes. Nothing is ever dropped or deleted, even when a
  column becomes obsolete (the old `warranties.photo` column is a real
  example — folded into a proper `warranty_documents` table in v11, but
  deliberately left in place). This matters because of how updates ship
  (see [§4](#4-how-updates-reach-the-phone--ota-vs-apk)): a web update can
  land on a phone whose native app (and therefore whose database) is
  several versions behind, so the code has to tolerate that gap rather than
  assume everyone is in lock-step.
- **A safety check (`assertNonDestructive`) scans every migration up front**
  for `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, `DROP COLUMN` and refuses to
  run *any* of them if it finds one — specifically so the app can never
  apply half a migration set and then fail partway through, leaving the
  database in a broken in-between state.
- **The database is deliberately *not* encrypted at rest.** It used to be,
  via SQLCipher keyed from the Android Keystore — but an app update could
  lose that key, which made the entire database permanently unreadable and
  threw users into data-recovery. That was worse than the risk it was
  protecting against, so encryption was removed on purpose. Protection now
  rests on Android's normal per-app sandboxing, and the only thing that ever
  leaves the device is the plain JSON backup file (never the raw database).

### Native bridges

Every native feature (SMS reading, camera, haptics, biometrics, print,
calendar, notifications, share) is wrapped in a JavaScript function in
`src/services/` that **degrades to doing nothing rather than crashing** if
the native capability isn't available — e.g. running in a browser, or on an
older APK that predates a given plugin. This is the same "OTA can outrun the
native app" concern showing up again: the code has to assume the web layer
it's running might be newer than the native shell underneath it.

### Reference doc

A deeper, code-level architecture write-up already exists at
[`docs/repository-study.md`](repository-study.md) on the branch
`claude/git-repository-study-mzpd75` (PR **#47**, currently open/unmerged —
see [§8](#8-whats-still-pending--open)). It covers the same ground in more
detail — worth pulling in if you need line-by-line file references.

---

## 3. The look of the app — themes ("skins")

The app supports **9 visual styles**, switchable in Settings, applied via a
`data-surface` HTML attribute that drives a big block of CSS custom
properties in `src/index.css` (see `src/services/theme.js`):

| Skin | Feel |
|---|---|
| Paper (default) | Plain, flat, no special surface effects |
| Carbon | Dark, high-contrast |
| Frosted (glass) | iOS-style translucency/blur |
| Neo | Neumorphic (soft embossed shapes) |
| Serene | Calm, muted |
| Clay | Soft claymorphism — puffy, rounded |
| Soft | Gentle shadows, soft edges |
| Liquid Glass | Extreme glassmorphism — refraction, specular highlights, SVG warp filters |
| Spatial | Extreme "3D" depth — device-tilt-tracking parallax on cards |

Liquid Glass and Spatial are the most expensive to render, so a separate
**depth tiering system** (`data-depth`, `src/services/depth.js`) auto-detects
device capability (via `deviceMemory`/`hardwareConcurrency`) and picks
`max` / `balanced` / `off` to gate the heaviest effects (blur, live tilt
tracking) on weaker phones. There's also a manual **frame-rate cap** setting
(30/60/90/120/180/240 Hz, `src/services/frameRate.js`) for matching animation
smoothness to what the device's screen can actually show.

---

## 4. How updates reach the phone — OTA vs APK

There are **two separate, independent update mechanisms**, and understanding
the difference matters:

### OTA (over-the-air) — the normal path, used for almost everything

- **What it updates:** the web layer only — all the React/JS/CSS code, i.e.
  everything under `src/`. This covers the overwhelming majority of what
  changes day to day: new screens, new features, bug fixes, visual changes.
- **How it ships (exactly):**
  1. A feature branch is merged into `main`.
  2. `web-version.txt` gets bumped (e.g. `1.5.4` → `1.5.5`) as part of that
     same change.
  3. `.github/workflows/deploy-ota.yml` runs automatically on every push to
     `main` that touches the web layer. It builds the app
     (`npm run build`), then runs `scripts/build-ota.mjs` to produce
     `latest.json` and a `budget-tracker-web-<version>.zip`.
  4. It commits those two files **to the root of the `main` branch itself**
     (not a separate branch) — because this repo's GitHub Pages is
     configured to serve from "main /(root)", so only files actually
     committed there are servable. The commit publishing them shows up in
     `git log` as `Publish web bundle X (automated)`, authored by
     `github-actions[bot]`.
  5. Publishing only happens if the version actually changed — it diffs
     `latest.json` (not the zip's raw bytes, since builds aren't
     byte-for-byte reproducible) and skips the commit if nothing moved.
  6. The **installed app on the phone checks `latest.json` in the
     background** and downloads the new bundle when it finds a newer
     version. `capacitor.config.json` sets `autoUpdate: false`, meaning the
     app always boots whatever bundle it already has first (so it still
     works fully offline), and only swaps in the new one after it's fully
     downloaded and verified — never a half-downloaded update.
- **You (or an AI session) never touch a phone or app store for this** — it's
  fully automatic once the branch is merged to `main`. To confirm a version
  actually went live, check: `git show origin/main:latest.json` should show
  the new version number.

### APK — the rare path, only when something *native* changes

- **What it updates:** anything OTA *can't* reach — new Android permissions,
  new native plugins, changes to `AndroidManifest.xml`, `build.gradle`
  version bumps, or anything Capacitor has to compile into the actual
  installed app package.
- **How it ships:**
  1. Bump `versionCode`/`versionName` in `android/app/build.gradle`.
  2. Manually trigger `.github/workflows/build-apk.yml` from the GitHub
     Actions tab (`workflow_dispatch` — it does **not** run automatically).
  3. It builds the Android app in the cloud, signs it with a keystore held
     in repository secrets (`ANDROID_KEYSTORE_BASE64` and friends — without
     these it still builds, but unsigned and unpublished, with a warning),
     and publishes it to **GitHub Releases** under the fixed filename
     `BudgetTracker.apk`, so the download link never changes:
     `https://github.com/singhashish8-spec/Budget-Tracker/releases/latest/download/BudgetTracker.apk`
  4. Whoever's using the app downloads and installs that APK by hand (or
     through whatever install mechanism the phone offers) — this does
     **not** happen automatically the way OTA does.
- **This is deliberately rare.** As of this writing, the installed app is
  running native code from **build 7 / v1.4** (cut 2026-07-27), while the
  *web* layer has moved on to 1.5.5 through five OTA-only releases since —
  confirmed safe because none of those five releases touched anything under
  `android/` or `capacitor.config.json`. A new APK build is only needed the
  day some future change actually requires new native permissions/plugins.

### Why not just always ship a new APK?

Because most changes don't need one, and asking a user to manually
reinstall the app for every UI tweak is a terrible experience compared to it
just updating itself silently. The OTA/APK split exists specifically so
"normal" changes are invisible and instant, and "the app store install
itself changed" stays rare and deliberate.

---

## 5. Complete version history

Every version bump on record, oldest first. "PR" links to the pull request
that shipped it (some very early commits predate PR tracking in this log and
are marked directly). Versions below **1.4.1** were built in earlier chat
sessions (some via Claude, at least one batch — v1.1.6 — explicitly credited
to Google's **Jules** agent in its commit message) — summarized here from
their commit messages, since this document's author (the current session)
wasn't present for them. Versions **1.4.1 onward** are from the current
session's direct, first-hand work and carry more detail.

| Web version | What shipped | PR |
|---|---|---|
| 1.0.32 | Earliest version in recorded git history (collapsing-header fix) | — |
| 1.0.33 | Manual "check for update" flow with progress UI; Settings reorganized into categories | [#27](https://github.com/singhashish8-spec/Budget-Tracker/pull/27) |
| 1.0.34 | Fixed the collapsing Home header (switched to a viewport `IntersectionObserver`); privacy "eye" toggle moved inside the hero balance card | [#28](https://github.com/singhashish8-spec/Budget-Tracker/pull/28) |
| 1.0.35 | Redesigned the pay-period dropdown on Home | [#29](https://github.com/singhashish8-spec/Budget-Tracker/pull/29) |
| 1.1.0 | "Big update pt.1" — one-handed popups; Transactions gets message previews + expand-to-detail | [#30](https://github.com/singhashish8-spec/Budget-Tracker/pull/30) |
| 1.1.1 | "Big update pt.2" — one-handed Add-transaction sheet; expand-in-place on Home & Budgets | [#31](https://github.com/singhashish8-spec/Budget-Tracker/pull/31) |
| 1.1.2 | "Big update pt.3" — every popup made one-handed reachable; net-worth section made collapsible | [#32](https://github.com/singhashish8-spec/Budget-Tracker/pull/32) |
| 1.1.3 | "Big update pt.4" — Smart Patterns (recurring-payment detection) becomes tap-to-expand | [#33](https://github.com/singhashish8-spec/Budget-Tracker/pull/33) |
| 1.1.4 | **Bug fix:** SQLite `FOREIGN KEY constraint failed (code 787)` blocking duplicate cleanup and SMS-linked deletes — see [§6](#6-notable-bugs-and-how-they-were-found-and-fixed) | [#35](https://github.com/singhashish8-spec/Budget-Tracker/pull/35) |
| 1.1.5 | "Big update pt.5" — collapsible date groups on Transactions | [#36](https://github.com/singhashish8-spec/Budget-Tracker/pull/36) |
| 1.1.6 | Integrated a feature/security batch from Google's **Jules** agent, published as one OTA | [#38](https://github.com/singhashish8-spec/Budget-Tracker/pull/38) |
| 1.1.7 | EMI progress bars (paid/due/remaining instalments), a "cooling-off" impulse-spend trigger, a real Warranty tracker | [#39](https://github.com/singhashish8-spec/Budget-Tracker/pull/39) |
| 1.1.8 | Fixed top-bar overlap app-wide, removed a duplicate camera button, wired Warranty into Bills/EMIs | [#40](https://github.com/singhashish8-spec/Budget-Tracker/pull/40) |
| 1.1.9 | Removed the (never-fully-wired) AI receipt-scanning feature; Warranty/EMI/Subscription cards became their own dashboards | [#41](https://github.com/singhashish8-spec/Budget-Tracker/pull/41) |
| 1.2.0 | Side-hustle mode (business income/expense tagging + GST), net-worth projections, spending forecasts, zero-based envelope budgeting | [#42](https://github.com/singhashish8-spec/Budget-Tracker/pull/42) |
| 1.2.1 | Full data reset added to Settings; version bump for the **v1.2 APK build (build 3)** | [#43](https://github.com/singhashish8-spec/Budget-Tracker/pull/43) |
| 1.3.0 | Native release batch: Android share-target intent, bill reminders, haptics, home-screen shortcuts, secure-screen (blocks screenshots) — **v1.2.1/v1.3.0 APK (builds 4–5)** | [#44](https://github.com/singhashish8-spec/Budget-Tracker/pull/44) |
| 1.3.1 | **Bug fix:** app hanging forever on "Restoring your data" — **v1.3.1 APK (build 6)** | [#45](https://github.com/singhashish8-spec/Budget-Tracker/pull/45) |
| 1.3.2 | **Bug fix:** haptic feedback silently firing nothing on the most common taps | [#46](https://github.com/singhashish8-spec/Budget-Tracker/pull/46) |
| 1.3.3 | Event budgets, CSV import (with remembered per-bank column mapping), full ZIP export (incl. warranty documents), native RCS/PDF/calendar/dynamic-colour support — database schema reaches **v13** | direct push |
| 1.3.4 | Shared UI primitive library, animated bars/figures, full haptic coverage across the app | direct push |
| 1.3.5 | Five selectable themes added; visual depth (shadows/elevation) applied consistently across every screen | direct push |
| 1.3.6 | Replaced every emoji used as an icon with real hand-drawn SVG icons | direct push |
| 1.3.7 | **Bug fix:** whole screen sliding sideways on Transactions (an overflowing child was dragging the fixed-position layout with it) | direct push |
| 1.4.0 | Reworked the Frosted (glass) theme to actually read as iOS-style glass — **v1.4 APK (build 7), still the currently-installed native build** | direct push |
| — | *(Session boundary — everything below is this current chat session's direct work, starting from "go and study my git repository")* | |
| 1.4.1 | **Bug fix:** backup/restore was silently dropping every table except categories on restore — see [§6](#6-notable-bugs-and-how-they-were-found-and-fixed). Restore failures are now recorded in an on-device error log (Settings) instead of failing silently | [#49](https://github.com/singhashish8-spec/Budget-Tracker/pull/49) |
| 1.5.0 | Four new "extreme" skins — Clay, Soft, Liquid Glass, Spatial — plus the device-tilt depth engine behind Spatial's parallax | [#48](https://github.com/singhashish8-spec/Budget-Tracker/pull/48) |
| 1.5.1 | Smoother motion using compositor-only CSS properties (`transform`/`opacity`) instead of layout-triggering ones; added the manual frame-rate cap setting (30–240 Hz) | [#50](https://github.com/singhashish8-spec/Budget-Tracker/pull/50) |
| 1.5.2 | **Bug fix:** Spatial skin's `perspective` CSS property was accidentally making the app shell a `position:fixed` containing block, throwing the tab bar/menu off-screen and locking users out of navigation entirely once they enabled it | [#51](https://github.com/singhashish8-spec/Budget-Tracker/pull/51) |
| 1.5.3 | **Bug fix:** the confirm-delete dialog was invisible on Liquid Glass/Spatial (near-transparent background), which also exposed a CSS specificity bug that had been silently killing every card's rim-light highlight on those two skins since 1.5.0 | [#52](https://github.com/singhashish8-spec/Budget-Tracker/pull/52) |
| 1.5.4 | Interaction-polish batch — 8 findings from a UI/UX audit: asymmetric press feedback, switch knobs using `transform`, search-field clear button, shared `ProgressBar` on Goals, tone-coloured toasts, custom category colour picker, animated onboarding transitions, tab-bar icons + sliding indicator | [#53](https://github.com/singhashish8-spec/Budget-Tracker/pull/53) |
| **1.5.5** *(current)* | Swipe-to-act transaction rows (swipe left to categorise/delete), pull-to-refresh (drag down to re-scan SMS), and a properly-measured sliding segmented control for the transaction filters | [#54](https://github.com/singhashish8-spec/Budget-Tracker/pull/54) |

### Native (APK) release history

| Tag | versionCode | Published | Notes |
|---|---|---|---|
| v1.2 | 3 | 2026-07-22 | First cloud-built signed release |
| v1.2.1 | 4 | 2026-07-26 | |
| v1.3.0 | 5 | 2026-07-26 | |
| v1.3.1 | 6 | 2026-07-27 | |
| **v1.4** | **7** | **2026-07-27** | **Currently the installed native build** — everything since (web 1.4.1–1.5.5) has shipped OTA-only, no native changes needed |

---

## 6. Notable bugs and how they were found and fixed

A curated set of the more instructive bugs — the ones worth understanding
even if you never touch that exact code again, because the *shape* of the
mistake tends to recur.

### The backup-restore bug that quietly deleted everything but categories

**Symptom:** users restoring a backup (or the app auto-restoring after an
update) would end up with only their categories intact — every transaction,
budget, bill, goal, net-worth entry, warranty and setting was gone.

**Root cause:** `importBackup()`'s SQL `INSERT` statement for transactions
declared **15 column names** but supplied **17 placeholders and 17 values** —
two columns (`business`, `gst_rate`) had been added to the values array when
side-hustle mode shipped, but nobody updated the column list to match.
SQLite rejects that outright ("17 values for 15 columns") and throws — on
the very *first* transaction in the restore loop. Categories were inserted
*before* transactions in the restore order, so they'd already succeeded;
everything queued after the crash point was simply never written.

This had been broken since the side-hustle release and had already caused a
*previous*, separate bug report ("app hangs forever on Restoring your
data," fixed in 1.3.1) — that earlier fix added a timeout so a failed
restore could no longer freeze the whole app, but it didn't (and couldn't
have, from its vantage point) fix the fact that the restore itself was still
failing every time. It just made the failure survivable instead of silent.

**Fix:** added the two missing columns to the column list; also fixed budget
period start/end dates not being restored (falling back to a plain calendar
month instead of the user's actual custom cycle); added reporting for
skipped documents; added a capped on-device error-log ring buffer
(Settings → shows the last N failures) so a *future* silent failure like
this leaves a trace instead of nothing.

**Verified with:** a real `node:sqlite` in-memory database, not just reading
the code — round-tripped an actual backup through `importBackup()` and
confirmed every table came back.

### Spatial skin's `perspective` property locking users out of the app entirely

**Symptom:** switching on the Spatial theme made the tab bar and hamburger
menu vanish, with no way to navigate or switch themes back — a full soft
lockout.

**Root cause:** the Spatial skin applied a CSS `perspective` value directly
to `.app-shell` to make its 3D tilt effect work. What wasn't accounted for:
in CSS, giving an element a `perspective` also makes it the **containing
block** for any `position: fixed` descendant. The tab bar and the menu
button both use `position: fixed` and were relying on being positioned
relative to the *viewport* — once their containing block became
`.app-shell` instead, they were positioned relative to a container that
doesn't span the same box, and both were thrown off-screen.

**Fix:** moved `perspective` off the shell and onto individual cards instead
(via the `perspective()` CSS *transform function*, applied per-element,
which doesn't have this containing-block side effect), preserving the same
visual tilt effect without hijacking the fixed-position layout.

### A CSS specificity tie that had been silently breaking a visual effect since it shipped

**Symptom:** while fixing an unrelated bug (the confirm-dialog being
invisible on Liquid Glass/Spatial), it turned out every card's rim-light
highlight had *never worked* on those two skins, since the day they shipped
— nobody had noticed because the rest of each skin's visual language was
busy enough to hide the missing highlight.

**Root cause:** two CSS rules — a generic "elevation" rule that resolves to
`box-shadow: none` for most cases, and each skin's own specific rim-light
rule — had **identical CSS specificity**. When two rules tie on specificity,
the one that appears *later in the source file* wins, regardless of which
one is "more specific" in spirit. The generic rule happened to come after
the skin-specific one in `index.css`, so it silently won on every load,
every time, with no error, no warning — just an effect that never rendered.

**Fix:** extended the generic rule's `:not()` exclusion list to also exclude
Liquid Glass and Spatial (it already excluded plain Frosted glass), letting
each skin's own rule apply as intended.

**How it was actually found:** not by reading the CSS and reasoning about
it — by writing a headless-browser script that read the *real, computed*
`box-shadow` value via `getComputedStyle()` across all 9 skins and comparing
them, which is what actually exposed that only two skins were wrong while
the rest were byte-identical. This is a general lesson that shows up
repeatedly in this project: for CSS cascade bugs, trust the computed output,
not a re-read of the source.

### The `FOREIGN KEY constraint failed (code 787)` bug

**Symptom:** cleaning up duplicate transactions, or deleting/ignoring a
single SMS-derived transaction, failed outright with a raw SQLite error.

**Root cause:** the `sms_log` table has a foreign key pointing at
`transactions(id)`. Deleting a transaction that still had a linked SMS
record violated that constraint.

**Fix:** both delete paths now detach the linked SMS record first
(`UPDATE sms_log SET txn_id = NULL`) — which also has the nice side effect
of keeping the message body in the "already imported" de-duplication memory,
so a deleted transaction's source SMS doesn't get re-imported next scan —
and only then delete the transaction itself.

### The invisible confirm-dialog

**Symptom:** the delete-confirmation dialog was practically see-through on
Liquid Glass and Spatial.

**Root cause:** it used `colors.bgApp` (the plain app background colour) for
its own background — which resolves to roughly 4–5% opacity on those two
skins specifically, since their whole aesthetic is built around a
near-transparent app background with visual weight coming from blur and
material effects on top, not solid colour.

**Fix:** switched to `colors.cardSurface` (the same solid-ish material every
card already uses) plus a proper border and entrance animation. Fixing this
is what surfaced the CSS specificity bug above — the dialog looked *right*
once it had a real surface, but its rim-light still wasn't showing, which is
what led to comparing computed styles across every skin.

---

## 7. Where things stand right now

- **Live web version:** 1.5.5 (confirmed published — `latest.json` on `main`
  reports it).
- **Live native APK:** v1.4 (build 7) — everything from 1.4.1 through 1.5.5
  has been safely OTA-only; no `android/` or `capacitor.config.json` changes
  have shipped since build 7 was cut.
- **Database schema:** v13, unchanged since the 1.3.3 release.
- **In progress this session:** a fourth UI-polish batch (working branch
  `claude/morph-empty-radii`, uncommitted), covering four more findings from
  the same UI/UX audit that produced 1.5.4/1.5.5:
  - Concentric corner radii (a small token-level helper so nested rounded
    surfaces stay visually consistent, instead of correct-by-luck).
  - Illustrated empty states (reusing the app's two-letter category-monogram
    visual language instead of a bare line of grey text).
  - A shared-shape "morph" from the **+** button into the sheet it opens
    (currently the button just vanishes and an unrelated sheet slides up —
    an already-built-but-unused gooey-blob SVG filter, `#bt-goo` in
    `GlassFilters.jsx`, is meant to be the finishing touch here).
  - A long-press quick-action menu on transaction rows (there is currently
    no press-and-hold handling anywhere in the app at all).

---

## 8. What's still pending / open

### Unmerged pull requests on GitHub

| PR | Title | Status | Notes |
|---|---|---|---|
| [#34](https://github.com/singhashish8-spec/Budget-Tracker/pull/34) | Fix SQLite crash + CSV injection vulnerabilities | Open, unmerged | From Jules. Downgrades `sql.js` to fix a WASM `LinkError` against `jeep-sqlite`, and hardens the CSV-injection regex for whitespace/BOM-prefixed payloads. **Needs triage** — check whether it's still needed against the current `main`, or already superseded. |
| [#37](https://github.com/singhashish8-spec/Budget-Tracker/pull/37) | Fix database reset on OTA app update | Open, unmerged | From Jules. Claims that reloading the WebView after an OTA update can leave the native SQLite connection in a state the JS layer misreads as "not open," triggering a false "corrupted database" reset into onboarding. **Needs triage** — this may already be mitigated by the "Restoring your data" hang fix (1.3.1) and/or the backup-restore fix (1.4.1), but hasn't been explicitly re-verified against them. |
| [#47](https://github.com/singhashish8-spec/Budget-Tracker/pull/47) | Add a structural study of the repository | Open, draft | An earlier Claude session's deep architecture write-up, `docs/repository-study.md`. Genuinely good reference material (this document borrows from it) but was never merged, so that file doesn't exist on `main` yet. Worth merging on its own, independent of any code change. |

### Deferred / dropped UI audit findings

From the original 18-item UI/UX audit (see 1.5.4/1.5.5 above for the ones
already shipped):

- **Edge-swipe-back gesture** — deliberately **dropped**, not just
  postponed: Android's own predictive-back gesture is already enabled
  (`android:enableOnBackInvokedCallback="true"`, `targetSdkVersion 36` in
  `android/variables.gradle`), which already covers this at the system
  level. Building a custom version risked double-handling the same gesture
  and conflicting with the bottom-sheet's own touch handling.
- The four items listed as "in progress this session" above (§7) — FAB
  morph, empty states, concentric radii, long-press menu — not yet shipped.

### Known gaps carried over from `docs/repository-study.md` (still true)

- **No automated tests anywhere** in the project — no test files, no test
  runner configured. `selectors.js`'s ~32 pure functions (budget-window
  math, warranty expiry, duplicate detection, envelope rollover) are the
  highest-value, lowest-friction place to start, since they take no I/O and
  already accept an injectable `now`.
- **No CI on pull requests** — both GitHub Actions workflows only run on a
  direct push to `main` or by manual trigger; nothing lints or builds a PR
  before it's merged.
- **`README.md` has drifted from reality** in three places: (a) its "Status:
  MVP core" section still lists Insights, goals, bill reminders, SMS
  tracking, Settings, CSV export and smart patterns as *not yet built* —
  all of them have existed as real screens for a long time; (b) it still
  recommends "switch to encrypted mode before shipping" for the database,
  when the code deliberately moved the *other* direction on purpose (see
  §2); (c) it documents an AI-receipt-scanning configuration path
  (`VITE_AI_PARSE_ENDPOINT` / `.env.example`'s `VITE_GEMINI_API_KEY`) for a
  feature that was removed in 1.1.9 and no longer exists in the code at all
  — worth either deleting that section or being explicit that it's an
  unbuilt future plan, not present behaviour. This needs a decision, not a
  purely mechanical doc fix.

---

## 9. Rules of the road — conventions for changing this codebase

- **Money is always integers.** Never introduce floating-point currency
  values.
- **Migrations are append-only and additive.** Never drop or rename a
  column, even a genuinely dead one — an older OTA-served web bundle running
  against a newer database may still read it.
- **New native calls get a degrade-to-no-op wrapper.** Assume the native
  side might be older than the web layer calling it (see §4).
- **Derived/computed logic belongs in `selectors.js`** as a pure function
  taking `now` as a parameter, not inline in a screen component.
- **After a web-only database write, call `persist()`.** Native writes are
  already durable; this is a web-dev-mode-only concern (`jeep-sqlite`).
- **Bump `web-version.txt`** for anything shipping via OTA (almost
  everything). Only bump `versionCode`/`versionName` in
  `android/app/build.gradle` — and trigger the separate APK workflow — when
  a change genuinely needs new native code/permissions.
- **`npm install` needs `--legacy-peer-deps`** — one native plugin
  (`capacitor-sms-inbox`) pins an older `@capacitor/core` peer dependency;
  it doesn't affect the web build. Both CI workflows already do this.
- **Prefer `transform`/`opacity` over `left`/`width`/`box-shadow` for
  animation** — the former are compositor-only and never trigger a layout
  or paint pass; this has been the source of several performance-motivated
  rewrites already (tilt highlights, switch knobs, tab-bar indicator, swipe
  rows).
- **Every gesture/animation respects the app's motion preference** —
  `data-motion="off"`/`"reduced"` plus the OS-level
  `prefers-reduced-motion` media query — check both when adding new motion.
- **Verify before calling something done.** The established pattern in this
  project: `npm run build` + `npm run lint` after every change, and for
  anything visual/interactive, an actual headless-browser (Playwright)
  check against the real component — not just a hand-written demo that
  looks similar — wherever feasible.
- **One feature branch per logical batch, off the latest `main`.** Don't
  pile unrelated work into one PR.

---

## 10. Glossary

*(for the non-technical reader)*

- **OTA (over-the-air) update** — an update that arrives automatically, in
  the background, without needing to reinstall the app. See §4.
- **APK** — the installable Android app package file. Needed only for
  updates OTA can't deliver. See §4.
- **SQLite** — a small, complete database that lives in a single file, with
  no separate server process. This app's entire data lives in one such file,
  on the phone itself.
- **Schema / migration** — the structure of the database (which tables and
  columns exist) and the step-by-step, versioned process of changing that
  structure over time without losing existing data.
- **Skin** — one of the app's 9 selectable visual themes (§3).
- **PR (pull request)** — a proposed set of code changes, reviewed (or, in
  this project's usual flow, directly merged by the same session that
  proposed it) and then merged into the main codebase.
- **Capacitor** — the toolkit that takes the web app (React/JS/CSS) and
  wraps it as a real, installable Android (and, potentially, iOS) app, while
  exposing native phone features to the web code.
- **Native vs. web layer** — "web layer" is the JS/CSS/React code, shippable
  instantly via OTA. "Native layer" is the actual compiled Android app
  package — permissions, native plugins — which can only change via a new
  APK.
