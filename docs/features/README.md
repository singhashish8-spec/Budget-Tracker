# Features

One file per major shipped feature: what it does, why it exists, what's
actually built. Written once a feature is real, not speculatively ahead of
it. Kept **current**, not historical — when a fact changes, edit in place
(the opposite discipline from `history/sessions/`).

This index covers the features substantial and bug-prone enough to warrant
their own file as of 2026-08-15. Smaller features (goals, quick-add, CSV
import, net worth/holdings, event budgets, envelope budgeting) are
documented in `roadmap/architecture.md` and their originating
`history/sessions/` entries but don't yet have a dedicated file — add one
the next time any of them needs real work.

| Feature | Status | Doc |
|---|---|---|
| SMS auto-capture & parsing | Built, rewritten once (PR #61) | `sms-engine.md` |
| Theming & skins (9 skins, depth engine) | Built | `theming-skins.md` |
| Backup, restore & auto-recovery | Built, root-caused twice | `backup-restore.md` |
| Bills, EMI & Warranty tracking | Built | `bills-emi-warranty.md` |
| OTA update pipeline | Built, root-caused once | `ota-updates.md` |
| AI/cloud document parsing | **Removed** (PR #41) | see `roadmap/decisions.md` |
