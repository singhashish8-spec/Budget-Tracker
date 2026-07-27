# Budget Tracker — handoff

Paste this into a new chat to pick up where we left off.

---

## 1. What this is

A **local-first personal finance app** for Indian households. React + Vite web layer wrapped in **Capacitor** for Android. All data lives in **on-device SQLite**. There is **no backend and no AI** — the AI was deliberately removed (see §6).

- **Repo:** `singhashish8-spec/Budget-Tracker`
- **Work branch:** `claude/emi-bills-warranty-features-xna6al`
- **Package id:** `com.budgettracker.app`
- **Live web bundle:** **1.3.2** (OTA)
- **Live APK:** **1.3.1** (`versionCode 6`)
- **Schema:** migrations through **v12**

> ⚠️ APK `versionName` is 1.3.1 while the web bundle is 1.3.2. That is correct — 1.3.2 was a JS-only fix that shipped over the air.

---

## 2. How releases work — read this before shipping anything

There are **two independent release channels**. Picking the wrong one wastes a cycle.

### OTA (web bundle) — for anything in `src/`
1. Bump `web-version.txt`
2. Merge to `main`
3. The **"Publish OTA web bundle"** workflow fires automatically, but **only if `web-version.txt` changed**
4. It commits the zip + `latest.json` to the repo root, which GitHub Pages serves
5. Users get it **on next app launch**

### APK — required for anything native
Needed when you touch `android/`, `AndroidManifest.xml`, or **add any Capacitor plugin**.
1. Bump **both** `versionCode` and `versionName` in `android/app/build.gradle`
2. Merge to `main`
3. Manually trigger the **"Build signed APK"** workflow (`build-apk.yml`, `workflow_dispatch`)
4. Signing secrets are configured and working
5. Published to: `https://github.com/singhashish8-spec/Budget-Tracker/releases/latest/download/BudgetTracker.apk`

**Rule of thumb:** new plugin or manifest change → APK. Everything else → OTA.

### Merge conflicts are routine
`main` gets an automated publish commit after every OTA, so the work branch goes stale constantly. Standard fix:
```bash
git fetch origin main && git merge origin/main
# resolve in favour of the branch (it has the newer work), then rebuild
```

---

## 3. Architecture

```
src/
  db/schema.js        migrations (v1–v12), additive only
  db/repo.js          ALL SQL lives here; screens never touch the DB
  db/sqlite.js        connection + resetDatabase()
  state/AppContext.jsx  single global store (useReducer); all CRUD callbacks
  state/selectors.js  every derived value — pure, testable
  services/           haptics, notify, appIntegration, backup, autoBackup,
                      smsParse, smsReader, theme, liveUpdate, exportReport
  screens/            one file per screen
  components/         Sheet, DetentSheet, ConfirmDialog, DocumentViewer,
                      WarrantyDetail, ReminderDetail, BottomNav, TopBar…
android/app/src/main/java/com/budgettracker/app/
  MainActivity.java             registers the plugin, handles onNewIntent
  AppIntegrationPlugin.java     share target, shortcuts, FLAG_SECURE
```

**Conventions that matter:**
- Screens → `AppContext` → `repo` → SQLite. Never skip a layer.
- Adding a context function? It must appear **twice** — in the `value` object *and* the `useMemo` deps array. Miss the value object and it's `undefined` at the call site.
- Migrations are **additive only** (`ADD COLUMN` / `CREATE TABLE`). Never destructive.
- New tables must also be added to **`gatherData()`** (backup) and **`importBackup()`** (restore), or the data won't survive a reinstall.
- Styling is inline, reading CSS custom properties via `theme/tokens.js`. No CSS framework.
- Screen top padding must be `calc(env(safe-area-inset-top, 0px) + 74px)` — a hardcoded `74px` puts content under the floating top bar on notched phones.

---

## 4. Data model (SQLite)

| Table | Notes |
|---|---|
| `transactions` | + `business`, `gst_rate`, `warranty_months`, `method`, `occurred_at` |
| `categories`, `budgets`, `settings` | budgets are **one row per category** (PK) — a real constraint |
| `reminders` | bills, EMIs, subscriptions. `kind`, `term_count`, `start_at`, `cadence` |
| `goals`, `net_worth_items` | net worth has `category` (gold/sip/fd/chit/property/cash), `quantity`, `unit` |
| `warranties` | product, brand, dates, months, extended, store, serial, `reminder_id` |
| `warranty_documents` | bills/PDFs as base64 data URLs, `warranty_id` |
| `warranty_claims` | repair/service log |
| `envelopes` | zero-based budgeting: `category_id` + `period_key` + `assigned` |
| `merchant_rules`, `pattern_prefs`, `sms_log`, `sms_ignores` | |

**Database is plaintext**, deliberately. SQLCipher was disabled because a previous app update broke the app's ability to open its own database. Re-enabling needs a tested migration — do not do it casually.

---

## 5. Features currently shipped

**Money:** SMS auto-capture (rule-based) · manual entry · budgets with pay-cycle periods · split 50/50 · duplicate cleanup · smart patterns · goals · net worth · CSV + HTML export

**Bills & EMIs:** segmented instalment progress bar · fixed-run bills with duration · subscriptions · mark paid per month · **read-only dashboards** (tap a card → dashboard, Edit is a second tap)

**Warranty:** dedicated panel · traffic-light status · cover-remaining bar · multiple documents (images **and PDFs**) · full-screen viewer with tap-to-zoom · claim & service history · linked to EMIs · included in backup

**Budgeting:** cooling-off warning (large purchase **or** 90% of budget) · spending forecast · **zero-based envelopes** (opt-in, Settings → Money) with rollover and carried-forward overspend

**Side hustle:** business flag + GST rate on transactions · Business filter · GST input-credit total on Insights

**Native:** share target (PDF/image → warranty) · local notifications (warranty 60/15 days, bills due, Mark paid action) · tiered haptics · launcher shortcuts · FLAG_SECURE with hide-balances · biometric app lock

**Settings:** themes/accent/glass/motion/haptics · currency · pay cycle · cooling-off limit · envelope toggle · backup & restore · document storage usage · **full reset** (type RESET to confirm)

---

## 6. Decisions already made — don't relitigate

1. **No AI.** Gemini receipt/statement scanning was removed entirely. It was the only thing sending personal financial documents to a third party. **Consequence:** no bank-statement or CSV file import at all. That gap is known and accepted.
2. **Documents stored inline in SQLite**, not as loose files — so they ride along in the backup and survive a reinstall. Cost is size; PDFs capped at 3 MB.
3. **Zero-based budgeting is opt-in** and sits alongside normal budgets rather than replacing them.
4. **Haptics are tiered, not on every touch.** iOS fires on state changes; buzzing on every tap feels cheap and drains battery.
5. **Cards open dashboards, not edit forms.** You open a card to check something far more often than to change it.
6. **Cut permanently:** location-based alerts (battery + permission cost), live investment price sync (brittle paid APIs).
7. **Monetisation (recommended, not built):** one-time ₹299–499 Pro unlock for tools; monthly only if cloud sync ever ships. Indian users resist subscriptions but will pay once.

---

## 7. Known issues & unverified work

**⚠️ Almost nothing has been verified on a physical device.** The web build cannot exercise native paths. Specifically unverified:
- Share sheet actually listing Budget Tracker
- Notification delivery and the Mark paid action
- Whether haptics are now felt (1.3.2 fix)
- The `DetentSheet` drag feel on Android WebView (scroll-vs-drag is the fiddly part)
- Whether the full reset lands on onboarding rather than the recovery prompt
- v11/v12 migrations against a real existing database

**Recently fixed — watch for regressions:**
- **App hung forever on "Restoring your data"** (1.3.1). A failed restore left `processing: true` with no exit, and `sessionStorage` reset each launch so it recurred every time. Fixed with a failure path, a 45s timeout, per-row isolation in `importBackup` (documents inserted **last**), and a "Continue anyway" escape hatch after 30s.
- **Haptics fired nothing** (1.3.2). `Haptics.selectionChanged()` is a **no-op on Android unless `selectionStart()` ran first** — the plugin guards it behind an internal flag. `select()` now uses `impact(Light)`.
- Top bar overlapped content on every screen (hardcoded `74px` vs safe-area inset).
- `addManualTransaction` silently dropped `warranty_months`.

**If haptics are still not felt:** check Settings → Appearance → Haptics is Full; the phone's system vibration/touch-feedback setting; and battery saver, which suppresses vibration on many Android skins.

---

## 8. Backlog

### Next up (agreed)
- **RCS bank messages.** ⚠️ **RCS is not SMS.** It never enters `content://sms`, so the current reader structurally cannot see it — there is no public Android API for third-party RCS access. The only realistic route is a **NotificationListenerService** reading the notification Google Messages posts. Needs a custom native plugin + `BIND_NOTIFICATION_LISTENER_SERVICE` + the user manually granting Notification access. Limits: forward-only (no history), text can be truncated. **Bonus:** the same listener catches bank/UPI app notifications, which is arguably worth more than RCS alone.
- **Native PDF export** via Android `PdfDocument`/`PrintManager` (today's "PDF" is really an HTML report). Avoids a JS library and gives Print for free.
- **Voice entry** using Android's on-device speech recogniser — no cloud, fits the local-first stance.
- **Festival & wedding event budgets** — named temporary envelopes with a date range and year-on-year comparison. Builds on the envelopes model.
- **CSV import without AI** — column-mapping step, remembered per bank. Replaces what the AI did.
- **Export all documents as a zip** — needs a browser zip lib (`fflate`); `archiver` in the repo is Node-only.
- **Calendar integration**, **clipboard capture**, **Material You dynamic colour**, **themed icon**, **predictive back**.

### Blocked
- **Google Drive OAuth backup** — needs a Google Cloud project + OAuth client created under the owner's account. Cannot be done without them.
- **Database encryption** — see §4.

### Bigger bets
- **Cloud sync (family/joint)** — the prize and the trap. Turns an on-device app into a server product: cost, security, conflict resolution. Months. Only once the free app is loved.
- **Home screen widget** — real Kotlin work, deserves its own release.

### Explicitly deprioritised
Custom dashboards (high effort, rarely used) · Quick Settings tile · Assistant integration · contacts picker.

---

## 9. India-specific ideas not yet built

Joint-family shared wallet (the real reason people want sync here) · festival/wedding budgets · gold & chit funds *(partly done via net-worth holdings)* · GST/business tag *(done)*.

---

## 10. Working agreements

- Discuss before building when asked — the owner often wants to think through design first.
- Ship in small, verifiable chunks; build and lint after every change.
- Be explicit about what was **not** verified, especially native behaviour.
- Report honestly when something is broken or was the assistant's own mistake.
- Never rewrite published git history (merge commits and CI bot commits showing as "Unverified" are normal and should be left alone).
