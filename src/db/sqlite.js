import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { MIGRATIONS, LATEST_SCHEMA_VERSION, BUILTIN_CATEGORIES } from './schema';

// Financial transaction history lives here. On native this is a real SQLite
// file; in the browser (dev / `npm run dev`) it's backed by jeep-sqlite +
// sql.js (IndexedDB-persisted) so the same code path works without a device.
//
// The database is stored UNENCRYPTED. It used to be encrypted at rest with
// SQLCipher, keyed by a secret in the Android Keystore — but an app update
// could lose that key, leaving the whole database undecryptable. The app then
// created a fresh, empty one and the user landed in recovery on every update.
// A plaintext database can't be locked out this way. It's still protected:
// Android sandboxes the app's private storage, and the ONLY thing ever copied
// off the device is the JSON auto-backup (never the raw database file). When an
// old encrypted database from a previous build is still on disk, opening it
// plaintext fails; the app then rebuilds a clean database and silently restores
// the latest auto-backup (see AppContext bootstrap).

const DB_NAME = 'budget_tracker';
const sqlite = new SQLiteConnection(CapacitorSQLite);
const isWeb = () => Capacitor.getPlatform() === 'web';
const isNative = () => Capacitor.isNativePlatform();

let dbPromise = null;

async function ensureWebStore() {
  if (!isWeb()) return;
  if (!customElements.get('jeep-sqlite')) {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    await defineCustomElements(window);
  }
  if (!document.querySelector('jeep-sqlite')) {
    document.body.appendChild(document.createElement('jeep-sqlite'));
  }
  await customElements.whenDefined('jeep-sqlite');

  // jeep-sqlite's web store can hang indefinitely (rather than reject) if
  // its wasm/worker init never completes in a given browser context — this
  // only affects `npm run dev`; native Android talks to real SQLite and
  // never calls this path. Fail loudly instead of freezing the app on a
  // blank spinner.
  await Promise.race([
    sqlite.initWebStore(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Web SQLite store (jeep-sqlite) did not initialize in time')), 10000),
    ),
  ]);
}

async function seedCategories(db) {
  for (let i = 0; i < BUILTIN_CATEGORIES.length; i++) {
    const c = BUILTIN_CATEGORIES[i];
    await db.run(
      `INSERT OR IGNORE INTO categories (id, label, mono, color, is_builtin, sort_order) VALUES (?,?,?,?,1,?)`,
      [c.id, c.label, c.mono, c.color, i],
    );
  }
}

// Safeguard: a migration must never be able to silently destroy user data.
// Any DROP TABLE / DELETE / TRUNCATE in a migration is rejected before it can
// run, so a future schema change can't wipe existing rows the way the
// original design was suspected of doing. Additive-only migrations
// (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN, CREATE INDEX) are safe.
const DESTRUCTIVE_SQL = /\b(DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+COLUMN)\b/i;

function assertNonDestructive(migration) {
  for (const stmt of migration.statements) {
    if (DESTRUCTIVE_SQL.test(stmt)) {
      throw new Error(
        `Migration v${migration.version} contains a destructive statement and was blocked to protect user data: ${stmt.slice(0, 60)}…`,
      );
    }
  }
}

async function runMigrations(db) {
  // Guard every migration up front — never partially apply then fail.
  MIGRATIONS.forEach(assertNonDestructive);

  let current = 0;
  try {
    const res = await db.query(`SELECT value FROM schema_meta WHERE key = 'schema_version'`);
    const row = res?.values?.[0];
    if (row) current = Number(row.value);
  } catch {
    // schema_meta doesn't exist yet on a brand new database — current stays 0
  }

  const pending = MIGRATIONS.filter((m) => m.version > current);
  if (!pending.length) return;

  for (const migration of pending) {
    for (const stmt of migration.statements) {
      await db.execute(stmt);
    }
  }
  await db.run(
    `INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(LATEST_SCHEMA_VERSION)],
  );

  if (current === 0) await seedCategories(db);
  if (isWeb()) await sqlite.saveToStore(DB_NAME);
}

async function openDb() {
  await ensureWebStore();
  // Always open the database in plaintext ('no-encryption'). If a database
  // file left over from a previous, ENCRYPTED build is still on disk, this
  // open() will reject (SQLCipher header isn't valid plaintext SQLite). We let
  // that error propagate: the app's bootstrap catches it and recovers by
  // rebuilding the database from the JSON auto-backup.
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
  const db = isConn
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await runMigrations(db);
  return db;
}

export function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

// Recovery for an unopenable database — most importantly, an old SQLCipher-
// encrypted database left on disk by a previous build that this plaintext code
// can no longer read. We delete the file so a clean plaintext database can be
// created, then the caller restores data from the JSON auto-backup. Also clears
// any leftover Keystore encryption secret from the old build so nothing lingers.
// Returns true if a reset happened.
export async function resetDatabase() {
  dbPromise = null;
  // The stale file might be encrypted, so a 'no-encryption' connection can't
  // open it — but delete() only needs the connection to exist, not to open.
  try {
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    const db = isConn
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    try { await db.close(); } catch { /* not open — fine */ }
    await db.delete(); // removes the DB file
  } catch {
    // If we couldn't delete via a connection, fall back to the raw plugin.
    try { await CapacitorSQLite.deleteDatabase({ database: DB_NAME }); } catch { /* best effort */ }
  }
  try { await sqlite.closeConnection(DB_NAME, false); } catch { /* ignore */ }
  if (isNative()) {
    // Best-effort: drop the old encryption secret. Harmless (and may be a no-op)
    // now that encryption is disabled; wrapped so it can't block recovery.
    try { await sqlite.clearEncryptionSecret(); } catch { /* ignore */ }
  }
  return true;
}

// Call after any write when running on web — jeep-sqlite keeps the live DB
// in memory and only persists to IndexedDB on request. Native writes are
// durable immediately, so this is a no-op there.
export async function persist() {
  if (isWeb()) await sqlite.saveToStore(DB_NAME);
}
