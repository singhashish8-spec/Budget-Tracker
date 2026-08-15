# Findings

Cross-session, append-only. A **Finding** is anything that changed the plan,
revealed a real bug's actual root cause, or taught a lesson worth remembering
beyond the session it happened in.

The first ten entries here are a **backfill** from `docs/PROJECT_HISTORY.md`
§6 (already-documented bugs) and this session's own archive dig, reformatted
to this file's template — not newly discovered in Session 12 unless noted.

---

## Finding: A shallow git clone hid ~26 PRs of the project's actual origin (Session 12)

**What was found:** the working copy in this session started as a shallow
clone (`git fetch --depth 50`). `docs/PROJECT_HISTORY.md` states "1.0.32 |
Earliest version in recorded git history" as if that were the true start of
the project. Running `git fetch --unshallow` recovered the real history:
167 commits on `main` going back to 2026-07-14 (the actual scaffold commit),
and 62 real PRs on GitHub, not the ~35 `PROJECT_HISTORY.md` accounts for.

**Why it happened / why it wasn't caught earlier:** whichever session wrote
`PROJECT_HISTORY.md` was almost certainly also working from a shallow or
otherwise history-limited clone, and treated "earliest commit I can see" as
"earliest commit that exists" without checking `git rev-parse
--is-shallow-repository` or cross-referencing the GitHub PR list.

**Impact on the plan:** the entire `docs/history/sessions/` backfill in this
session was built from the recovered full history plus GitHub PR bodies
(`mcp__github__list_pull_requests`), not from `PROJECT_HISTORY.md` alone —
PRs #1–26 (OTA/APK delivery fixes, goals, dashboards, bill types, smart
patterns, theming, quick-add, the DB-encryption removal, frosted glass,
motion) would otherwise still be undocumented.

**Standing lesson:** before trusting "earliest recorded" claims in any repo
doc, check `git rev-parse --is-shallow-repository` and unshallow if true —
a shallow clone fails silently; it doesn't error, it just quietly shows a
smaller history as if it were the whole thing.

---

## Finding: Two open Jules PRs (#34, #37) look superseded but were never confirmed as such (Session 12)

**What was found:** PRs #34 ("Fix SQLite crash + CSV injection vulnerabilities")
and #37 ("Fix database reset on OTA app update"), both authored by Google's
Jules agent, are still open and unmerged on GitHub. PR #38's own body
("Integrate Jules's 1.1.6 feature set + security fixes") describes shipping
functionally equivalent fixes — the same `sql.js` version pin, the same
CSV-injection regex hardening, the same DB-connection-consistency check —
apparently reimplemented by hand rather than merging #34/#37 directly.

**Why it happened / why it wasn't caught earlier:** `PROJECT_HISTORY.md`
already flagged both PRs as needing triage rather than asserting they were
superseded — this session did not go further and diff #34/#37 against
current `main` to confirm the overlap; it's read from PR-body descriptions,
not verified line-by-line.

**Impact on the plan:** listed as pending triage in `history/status.md` and
`roadmap/decisions.md`, phrased as "likely superseded, not confirmed" —
not closed and not treated as resolved.

**Standing lesson:** "another PR's description says it did the same thing"
is not the same claim as "diffed and confirmed redundant" — don't let the
weaker claim get silently upgraded to the stronger one in a status doc.

---

## Finding: SQLCipher key loss bricked the on-device database on every app update

**What was found:** the database was encrypted at rest with SQLCipher, keyed
from the Android Keystore. An app update could lose that key, and a
plaintext-mode open of a stale encrypted file fails — which the bootstrap
read as "database corrupted," dropping the user into recovery **on every
update**, not just occasionally.

**Why it happened / why it wasn't caught earlier:** the risk of the Keystore
key not surviving an update path is not obvious from reading the encryption
code in isolation — it only showed up as a real, repeated, on-device symptom
across several update cycles before it was root-caused.

**Impact on the plan:** the database was moved to storing data unencrypted
(PR #17), protected instead by the Android app sandbox — the only thing that
ever leaves the device is the JSON auto-backup, never the raw file. This is
a permanent architectural decision — see `roadmap/decisions.md`.

**Standing lesson:** a key that can silently disappear across an OS-level
update path is a worse failure mode than the confidentiality it buys,
*specifically* for a device-local app with no server-side key escrow.

---

## Finding: excluding `sms_log` from backups caused every restore to double all SMS-derived data

**What was found:** `sms_log` (the SMS de-duplication memory — which
message bodies have already been imported) was never included in backups.
After any restore, that memory came back empty, so the next SMS scan
re-imported every already-present message as a brand new transaction —
doubling income and spending.

**Why it happened / why it wasn't caught earlier:** `sms_log` looked like
internal bookkeeping, not user data, so it was a plausible thing to leave
out of a "your data" backup — until the de-dup semantics that depended on
it were traced end to end.

**Impact on the plan:** `sms_log`, `sms_ignores`, and `settings` (crucially
the SMS scan high-water mark) were added to backup/restore, plus an
independent idempotency guard in SMS import (never re-add a message whose
exact timestamp+amount+direction already exists as a transaction) — so even
an *old* backup predating this fix restores safely.

**Standing lesson:** "de-duplication memory" is user data too, the moment
losing it changes what the user sees after a restore.

---

## Finding: a column-count mismatch in `importBackup()` silently deleted every restore down to categories only

**What was found:** the transactions `INSERT` in `importBackup()` declared
15 column names but supplied 17 values (two columns, `business`/`gst_rate`,
were added to the values array when side-hustle mode shipped, without
updating the column list). SQLite rejects that and throws on the *first*
transaction row — and because categories were inserted earlier in the
restore order and had already succeeded, every restore silently produced
"categories only, everything else gone," with no error surfaced to the user.

**Why it happened / why it wasn't caught earlier:** an earlier, separate fix
(the "hangs forever on Restoring your data" bug, 1.3.1) added a timeout so a
failed restore couldn't freeze the app — but that fix only made the failure
*survivable*, not *visible*; the restore kept silently failing underneath it
for another several releases.

**Impact on the plan:** fixed the column list; also fixed budget period
start/end dates not restoring correctly, added skipped-document reporting,
and added a capped on-device error-log ring buffer specifically so a future
silent failure like this one leaves a trace.

**Standing lesson:** a fix that makes a failure *stop crashing the app* is
not the same as a fix that makes the *underlying operation succeed* — verify
the operation's actual output, not just that it no longer hangs or throws
where a user can see it.

---

## Finding: a CSS specificity tie silently broke a visual effect on two skins since launch, found only by comparing computed styles

**What was found:** every card's rim-light highlight had never rendered on
the Liquid Glass and Spatial skins, since the day each shipped. A generic
"elevation" rule and each skin's own rim-light rule had identical CSS
specificity; on a tie, the rule appearing later in `index.css` wins
regardless of intent, and the generic rule happened to come later.

**Why it happened / why it wasn't caught earlier:** the rest of each skin's
visual language was busy enough that a missing rim-light wasn't visually
obvious, and reading the CSS source doesn't surface a specificity tie —
both rules "look" like they should apply.

**Impact on the plan:** found only via a headless-browser script comparing
the real `getComputedStyle()` box-shadow value across all 9 skins.

**Standing lesson:** for CSS cascade bugs specifically, trust computed
output over a re-read of the source — this is called out in
`docs/PROJECT_HISTORY.md` as a lesson that "shows up repeatedly."

---

## Finding: `setPointerCapture` called eagerly on every tap silently broke tap-to-expand for every user

**What was found:** starting the moment swipe-to-act rows shipped (1.5.5),
tapping a transaction row to expand it stopped working — for every row, for
every user. Swiping still worked.

**Why it happened / why it wasn't caught earlier:** `onPointerDown` called
`setPointerCapture` unconditionally, including on a plain tap with no drag.
Per the Pointer Events spec, once a pointer is captured, its `pointerup`/
`click` gets retargeted to the *capturing* element — here, the row's outer
div, not the nested `<button>` the tap handler lived on, and `click` never
bubbles back down into descendants. The PR that introduced this tested that
*dragging* worked; it never re-tested that a *plain tap* still worked
afterward, because pointer-capture's effect on an unrelated button's click
handler isn't something a reviewer would think to re-check without already
suspecting it.

**Impact on the plan:** `setPointerCapture` now only fires once a drag is
actually confirmed (inside `onPointerMove`, past the swipe-intent
threshold), matching the pattern `Screen.jsx`'s pull-to-refresh already used
correctly.

**Standing lesson:** whenever a change touches `setPointerCapture` or
pointer-event handling on a surface that *also* has its own plain tap/click
behaviour, explicitly re-test the plain-tap path, not just the new gesture.

---

## Finding: `min-height: 100vh` on the app shell silently defeated in-container scrolling app-wide

**What was found:** reported as "it is not scrolling on any page" — every
screen, not one. `.app-shell` was `min-height: 100vh` ("at least as tall as
the viewport," not "exactly"), so the shell grew to fit its content, and
every screen's `flex: 1` scroll container grew to match, making
`scrollHeight === clientHeight` everywhere — `overflow-y: auto` had nothing
to scroll. It *appeared* to scroll because the overflow escaped to the
document instead, which is also what broke pull-to-refresh: `Screen.jsx`
decided "is this a refresh pull or a scroll?" by checking `scrollTop > 0`,
and on a container that can never scroll, `scrollTop` is permanently 0 — so
every downward drag anywhere was claimed as a refresh pull instead of a
scroll.

**Why it happened / why it wasn't caught earlier:** the accidental
document-level scroll masked the bug well enough to ship and look correct in
casual use; it only became obviously broken through the fixed TopBar/
BottomNav not tracking a document scroll, and Android WebView's different
overscroll handling at the document level.

**Impact on the plan:** shell changed to `height: 100dvh` (with `100vh`
fallback) + `overflow: hidden`; three descendants with their own hardcoded
`min-height: 100vh` were fixed to not overhang a shorter dynamic viewport.

**Standing lesson:** `min-height: 100vh` on an app shell whose children rely
on `overflow: auto` is a silent, total defeat of in-container scrolling —
every ancestor in a nested-scroll-container chain needs a *bounded* height,
or the innermost `overflow: auto` is decoration only.

---

## Finding: the SMS parser could not tell a bill reminder from an actual bill payment

**What was found:** reported directly by the project owner — reminder
messages from banks/EMI companies ("Rs.5,000 will be debited on 05-Aug")
were being imported as real transactions, double-counting spend against the
actual debit later. A second, quieter bug: on message templates that lead
with the account balance rather than the transaction amount, the parser
imported the *balance* as the spend.

**Why it happened / why it wasn't caught earlier:** the parser's check was
"does this message contain an amount AND a word like *debited*?" — a
substring test can't distinguish "debited" from "**will be** debited,"
since both contain the literal substring.

**Impact on the plan:** rewrote `smsParse.js` — a completed-verb requirement
(checks the ~24 characters *before* each verb for future/negation markers),
position-scored amount extraction (skips figures with balance context in
the ~30 characters before them), and recurring-payment classification
(EMI/SIP/subscription detection with auto-categorization). Verified against
the project's **first automated test suite** (33 cases,
`src/services/smsParse.test.js`) — old parser: 3 wrong out of 16 real
messages; new parser: 0 wrong.

**Standing lesson:** for a parser whose failures are silent (a
wrongly-imported reminder looks identical to a real transaction in the
list), a corpus of real message templates as an automated test is the
highest-leverage place to invest — regex changes are prone to fixing one
template while breaking three others, which review alone won't catch.

---

## Finding: the AI-scanning docs (`.env.example`, README) still describe a feature removed in 1.1.9

**What was found:** originally flagged by the unmerged repository study
(PR #47, `docs/repository-study.md` §7.1): `README.md` documents posting to
a backend proxy endpoint, `.env.example` documents a client-side
`VITE_GEMINI_API_KEY`, and the two give **opposite security advice** — while
the actual code (as of PR #41, "Remove the AI...") references neither
variable at all; `aiExtract.js` doesn't exist in the tree. Confirmed still
true as of this session (2026-08-15): `.env.example` is untouched.

**Why it happened / why it wasn't caught earlier:** removing a feature
(PR #41) didn't include an audit of which config/doc files described it;
`.env.example` is the kind of file that's easy to forget because nothing
in CI reads or lints it.

**Impact on the plan:** still open — see `history/status.md` and
`roadmap/decisions.md`. Not fixed in this session (documentation-only,
no code/config changes made).

**Standing lesson:** removing a feature's code doesn't remove the feature's
footprint in onboarding docs and example config — those need their own
explicit check.
