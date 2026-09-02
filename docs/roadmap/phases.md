# Phases

> No single canonical phases document existed before this session (2026-08-15)
> — this is reconstructed from phase/group references scattered across PR
> bodies in `history/sessions/`. **At least two different phase-numbering
> schemes were used at different points in the project's life, and neither
> was ever written down as a standalone plan** — both are inferred from
> PR-body references to a plan the sessions clearly had access to but never
> committed to the repo. Treat the numbering below as reconstructed, not
> authoritative.

## Scheme A — the "design roadmap" ("Feel" / "Polish")

First referenced around PR #20 (2026-07-22, "First piece of the design
roadmap's 'Feel' upgrade") and PR #24 (2026-07-23, "Phase 1 + Phase 4
polish (OTA)"). Visible phases:

- **Phase 1 ("Feel")** — frosted glass (#20–22), motion/transitions (#23).
  Later polish items under the same "Feel" umbrella (animation levels) show
  up folded into #24.
- **Phase 4 ("Polish")** — hide-balances privacy blur, skeleton loading,
  richer search, wider SMS coverage (#24); later the collapsing hero header,
  deferred out of #24 for on-device risk, shipped separately (#25/26/28).
- **Phases 2 and 3** under this scheme are never referenced anywhere in the
  recovered PR history — either skipped, folded into other work, or simply
  never named explicitly in a surviving PR body.

## Scheme B — the "Pro roadmap"

First referenced in PR #39 (2026-07-26, "Phase 1 of the Pro roadmap —
finishing the everyday features rather than jumping to Phase 2"):

- **Phase 1** — EMI/bill progress bars, a cooling-off warning that actually
  fires, a first-class Warranty tracker (#39).
- **"Group B"** (PR #42, 2026-07-26) — side-hustle/GST tagging, net-worth
  projections, manually-priced holdings, subscription price alerts, spending
  forecast, envelope budgeting. Whether "Group B" is this scheme's "Phase 2"
  under a different label, or a separately-tracked list, isn't recoverable
  from the PR body alone.

## What's actually next (inferred from `history/status.md` and
`roadmap/decisions.md`, not from either scheme above)

Neither scheme's later phases are referenced again after 2026-07-26 — from
PR #47 onward the work is organized around a UI/UX audit (an 18-item list,
fully worked through by PR #58) and bug reports, not phase numbers. As of
2026-08-15, the concrete open items are the ones in `history/status.md`'s
"What's still pending" section: triaging PRs #34/#37/#47, deciding the
`.env.example`/README AI-scanning drift, and — the largest structural gap —
no automated tests beyond the one SMS-parser suite, and no CI on pull
requests. If this project writes a real forward-looking phase plan, it
belongs in this file, replacing this reconstruction.
