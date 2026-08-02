// A small on-device record of things that went wrong.
//
// This app swallows a LOT of errors on purpose — a failed haptic or a backup
// location that refused a write must never interrupt someone logging a spend.
// That is correct for the user and terrible for whoever has to fix the app: a
// broken restore path survived four releases precisely because every failure on
// it was caught, ignored, and left no trace anywhere.
//
// So failures stay silent to the user, but stop being invisible.
//
// ── Why localStorage and not a table ──────────────────────────────────────
// The failures that matter most are the ones where SQLite itself didn't open
// or a migration threw. A log living inside the database cannot record the
// database failing to load, which is the exact moment you need it. localStorage
// is available before the store is, survives a restart, and survives the
// database being deleted and rebuilt. It also needs no migration, so adding
// this can't itself become a schema-compatibility problem.
//
// ── Privacy ───────────────────────────────────────────────────────────────
// This is a finance app, and the log is included in the exported ZIP. Nothing
// here may carry financial content: no amounts, no merchant names, no SMS
// bodies, no document data. Callers pass a scope and an Error; `detail` is for
// counts and identifiers ("14 of 62 skipped"), never for values. Keep it that
// way — a diagnostic that leaks a user's spending is worse than no diagnostic.

const KEY = 'bt-error-log';
// Enough to see a pattern across a few sessions, small enough that the whole
// log stays a few tens of KB inside localStorage's ~5 MB budget.
const MAX_ENTRIES = 200;
const MAX_MESSAGE = 240;
const MAX_DETAIL = 200;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Quota exhausted or storage disabled. Drop the oldest half and try once —
    // a log that fills up should degrade to "recent only", not start throwing
    // from inside every catch block in the app.
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(Math.floor(list.length / 2))));
    } catch {
      /* storage genuinely unavailable — give up silently, as this must */
    }
  }
}

// Record a failure. Synchronous, never throws, never awaits — safe to call from
// inside any catch without changing that code path's timing or error behaviour.
//
//   scope  where it happened, as a stable dotted key: 'autoBackup.write'
//   err    the caught Error (or anything — it gets stringified)
//   detail optional non-sensitive context: counts, ids, a directory name
export function logError(scope, err, detail) {
  try {
    const message = (err && (err.message || String(err))) || 'Unknown error';
    const entry = {
      at: Date.now(),
      scope: String(scope || 'unknown').slice(0, 60),
      message: String(message).slice(0, MAX_MESSAGE),
    };
    if (detail != null) entry.detail = String(detail).slice(0, MAX_DETAIL);

    const list = read();
    const last = list[list.length - 1];
    // Collapse an identical failure repeating back-to-back (a retry loop, a
    // per-row error in a long import) into one entry with a count, so one bad
    // condition can't flush the whole buffer of useful history.
    if (last && last.scope === entry.scope && last.message === entry.message && last.detail === entry.detail) {
      last.count = (last.count || 1) + 1;
      last.at = entry.at;
      write(list);
      return;
    }

    list.push(entry);
    while (list.length > MAX_ENTRIES) list.shift();
    write(list);
  } catch {
    /* logging must never be the thing that breaks a flow */
  }
}

// Newest first, for display.
export function listErrors() {
  return read().slice().reverse();
}

export function errorCount() {
  return read().length;
}

export function clearErrors() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

// Plain-text rendering for the ZIP export and the "copy" button, so a problem
// can be handed over without a screenshot of a scrolling list.
export function formatErrors() {
  const list = read();
  if (!list.length) return 'No errors recorded.\n';
  const lines = list.map((e) => {
    const when = new Date(e.at).toISOString();
    const times = e.count > 1 ? ` (x${e.count})` : '';
    const detail = e.detail ? ` — ${e.detail}` : '';
    return `${when}  [${e.scope}]${times}  ${e.message}${detail}`;
  });
  return `${lines.length} entries, oldest first\n\n${lines.join('\n')}\n`;
}
