# Feature: SMS auto-capture & parsing

> Part of `features/`. Status: **built** (2026-07-14, MVP), **rewritten**
> (2026-08-02, PR #61). The app's single biggest differentiator — automatic,
> local, rule-based transaction capture from bank/UPI SMS, with no cloud
> parsing involved.

## Summary

Reads the device's SMS inbox (and, since PR #45's schema-v13 batch, bank/UPI
app **notifications** via `NotificationListenerService` — the only route to
RCS messages, which never reach `content://sms`), parses Indian bank/UPI/NBFC
message templates into transactions, and de-duplicates against what's
already been imported.

## Why this exists

Manual entry is the default failure mode of every budgeting app — people
stop logging spend within weeks. Automatic capture from the SMS a bank
already sends is the app's core promise, and it has to be fully local: no
message body should ever leave the device.

## What's built

- **`src/services/smsParse.js`** — pure parser, string in, structured object
  out. Recognises `₹`, `Rs`, `INR`; multiple debit/credit verb phrasings;
  AU Bank's `Dr`/`Cr` short form (added PR "AU Bank" fix, Session 04).
- **`src/services/smsReader.js`** — reads the inbox, de-duplicates the
  one-payment-two-messages case.
- **De-duplication memory** — `sms_log` records every message body already
  imported. This was excluded from backups early on, causing every restore
  to double all SMS-derived data (fixed PR #12) — see `history/findings.md`.
  A second, independent idempotency guard (never re-add a message whose
  exact timestamp+amount+direction already exists as a transaction) was
  added at the same time, so even an old backup restores safely.
- **Merchant category rules** (`merchant_rules` table, PR #11) — a smart
  pattern can be told "always file under X," which both re-files existing
  transactions and auto-categorizes future ones from that merchant on
  import.
- **The 2026-08-02 rewrite (PR #61)** — see `history/findings.md` for the
  full root-cause writeup. In short: the parser previously asked only "does
  this contain an amount AND a debit-shaped word?", which couldn't
  distinguish a real debit from a **future-tense reminder** ("will be
  debited"), and picked the *first* currency figure in a message regardless
  of whether it was actually the balance, not the transaction amount. The
  rewrite added:
  - A completed-verb requirement — checks the ~24 characters before each
    verb occurrence for future modals (`will`, `shall`, `to be`) or
    negations (`not`, `failed to`); whole-message disqualifiers reject
    OTPs, declined payments, UPI collect requests, and mandate-registration
    messages (as distinct from mandate execution, which does say "debited").
  - Position-scored amount extraction — skips currency figures with balance
    context (`bal`, `avl`, `available`, `limit`, `outstanding`) in the ~30
    characters before them; the first non-balance figure wins.
  - Recurring-payment classification — EMI/NACH/SIP/subscription phrasing
    plus a list of ~25 well-known recurring merchants map to a `kind` and
    `autoCat`, applied when the user has no rule of their own.
  - `rejectionReason(body)` — exported so a message that isn't imported can
    say *why* (`reminder`, `scheduled`, `promotional`, `failed`,
    `payment-request`, `mandate-setup`, `otp`).
- **Parser-feedback export (PR #62)** — marking a message "not a
  transaction" from inside the app can export a redacted, non-identifying
  record of why the parser misjudged it, to grow the test corpus.
- **`src/services/smsParse.test.js`** — the project's first automated test
  suite, 33 cases against real bank templates, run via `node --test`. Still
  the only test file in the repo as of 2026-08-15.

## Open questions

- No test coverage beyond the 33-case corpus that shipped with the rewrite
  — the corpus should grow via the PR #62 feedback-export loop, but whether
  that's actually happening (feedback being fed back into the test suite)
  isn't tracked anywhere yet.
- See `roadmap/architecture.md` §8 for the project-wide "no CI on PRs" gap,
  which applies here too — a parser change could regress the 33-case suite
  without any automated check blocking merge.
