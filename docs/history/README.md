# `docs/history/`

The append-only record of what happened, in order. Two rules distinguish it
from `roadmap/` and `features/`:

- **`sessions/*.md` and `findings.md` are never edited after the fact.** If
  something written here turns out to be wrong, it's corrected in a *new*
  entry that says so and links back — not by rewriting the old one.
- **`status.md` is the one exception** — it's overwritten every session. It's
  the only file in this folder that isn't a historical record.

## Files

- **`status.md`** — where things stand right now. Start here.
- **`findings.md`** — cross-session findings: bugs whose root cause mattered
  beyond the fix, lessons that changed the plan, misdiagnoses worth
  remembering. Not every session produces one.
- **`sessions/`** — one file per work session. Sessions before 2026-08-15
  were **backfilled** from the full git/PR history (see the note at the top
  of `sessions/2026-07-14-session-01.md` for how that backfill was done and
  its limits) rather than written live; sessions from 2026-08-15 onward are
  written contemporaneously, before moving to the next piece of work.
