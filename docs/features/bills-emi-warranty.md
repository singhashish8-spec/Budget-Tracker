# Feature: Bills, EMI & Warranty tracking

> Part of `features/`. Status: **built** (started 2026-07-22, PR #6; most
> recent work 2026-07-26, PRs #39–41).

## Summary

Recurring bills can be typed as plain **Bill**, **Loan/EMI**, or
**Subscription**, each with type-specific math (instalment progress, payoff
date, annualised cost). A first-class **Warranty** tracker holds product
details, photo/PDF documents, and links to the bill/EMI that financed the
purchase. Tapping any of these cards opens a read-only dashboard by
default — editing is a deliberate second tap.

## Why this exists

Started from a simple typed-bills request (PR #6: "Bill types: loan/EMI and
subscription"). Grew substantially in the "Pro roadmap"'s Phase 1 (PR #39)
into segmented progress bars and a real Warranty tracker, explicitly framed
as "finishing the everyday features rather than jumping to Phase 2" — see
`roadmap/phases.md`.

## What's built

- **`billRow()` selector** — computes paid/remaining/payoff math uniformly
  for EMIs and any bill given a duration + start month (extended to plain
  bills in PR #39, previously EMI-only).
- **Segmented progress bars** — paid instalments green, the currently-due
  one amber, the rest grey; loans over 24 instalments fall back to a single
  continuous fill bar for readability.
- **Cooling-off / impulse warning** — originally only fired when total
  cycle spend hit 90% of budget (rarely triggered in practice); PR #39
  added a second, independent trigger: any single expense at or above a
  configurable threshold (default ₹5,000), with a Settings control to
  adjust or disable it.
- **`warranties` table** (migration v10) — product, brand, price, purchase
  date, warranty + optional extended months, store/dealer, serial/invoice
  no., linked EMI/bill, note, and (migration v11) **multiple** documents
  per warranty (photos *and* PDFs, since Indian bills often arrive by
  email) rather than the original single photo column. v11 folds old
  single-photo data into the new table without dropping the old column —
  see `roadmap/architecture.md` §2 on why.
- **Traffic-light status** — in-warranty / expiring (≤30 days) / expired,
  surfaced both in the Warranties screen and a Home "expiring soon" banner.
- **`DetentSheet`** (PR #41) — an iOS-style half-height/full-height drag
  sheet used for the read-only dashboards on warranty/EMI/bill/subscription
  cards, replacing the original edit-first tap behavior — see
  `roadmap/decisions.md` for why.
- **Images open full-screen with tap-to-zoom; PDFs open in the phone's
  document viewer** — deliberate: an Android WebView renders an inline PDF
  data URL as a blank frame, which would look like data loss (PR #41).
- **Deleting a document or warranty asks first** (PR #41) — previously a
  single stray tap destroyed the only copy of a bill.
- Warranties are included in backup/restore and the ZIP export.

## Open questions

- PR #39's own body: photo capture on Android WebView and the v10 migration
  applying cleanly on an existing database were both flagged as needing
  manual on-device QA — not confirmed one way or the other in the recovered
  history.
- PR #41's own body: `DetentSheet`'s touch handling and the v11 migration
  were both flagged as unverified on a device.
