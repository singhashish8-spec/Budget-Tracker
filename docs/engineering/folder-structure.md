# Folder structure

> Kept current — edit in place when the layout changes. As of 2026-08-15.

```
android/                Capacitor native shell (Java plugins, manifest, Gradle)
docs/                   This documentation system (+ PROJECT_HISTORY.md, legacy)
public/                 Static assets
scripts/                release-web.mjs, release-apk.mjs, build-ota.mjs
src/
  components/           Reusable UI (Card, Chip, Toast, ConfirmDialog, ...)
    ui/                 Design-system primitives (Sheet, DetentSheet, Collapse,
                         ProgressBar, ListRow, EmptyState, Icon, CountUp, ...)
  db/                   sqlite.js (connection+migrations), schema.js, repo.js
  screens/              One file per screen (Home, Transactions, Budgets, ...)
  services/             Native bridges, parsing, export — see roadmap/architecture.md §4
  state/                AppContext.jsx (reducer/bootstrap/actions), selectors.js
  theme/                theme.js, tokens.js
  utils/                Shared helpers
```

See `roadmap/architecture.md` §1 for the dependency direction between these
layers (screens/components → state → db/repo → db/sqlite, with services
bridging to native) — screens never call `repo` directly.

## Notable single files

- **`src/state/AppContext.jsx`** — the largest file in the codebase:
  reducer, bootstrap, every mutation action. Flagged in `roadmap/
  architecture.md` §8 as the file most likely to cause merge conflicts
  between parallel feature branches.
- **`src/state/selectors.js`** — dozens of pure derived-data functions,
  each taking `now = new Date()` as a defaulted, injectable parameter.
  Flagged as the highest-value, lowest-friction place to add test coverage.
- **`src/services/smsParse.js`** + **`smsParse.test.js`** — see
  `features/sms-engine.md`.
- **`src/services/errorLog.js`** — the on-device diagnostics ring buffer,
  deliberately `localStorage`-backed, not DB-backed — see `roadmap/
  decisions.md`.
