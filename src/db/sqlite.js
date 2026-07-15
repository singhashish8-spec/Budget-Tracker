import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { MIGRATIONS, LATEST_SCHEMA_VERSION, BUILTIN_CATEGORIES } from './schema';

// Financial transaction history lives here. On native this is a real SQLite
// file, encrypted at rest with SQLCipher (see ensureEncryptionSecret below);
// in the browser (dev / `npm run dev`) it's backed by jeep-sqlite + sql.js
// (IndexedDB-persisted, unencrypted — dev convenience only) so the same code
// path works without a device.

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

// The plugin persists the encryption secret itself via the OS's secure
// storage (Android Keystore-backed) once set — we never store or see the
// passphrase again after this call. isSecretStored() MUST be checked first:
// calling setEncryptionSecret a second time would try to re-encrypt with a
// new secret and make the existing database unreadable.
async function ensureEncryptionSecret() {
  if (!isNative()) return;
  const { result: stored } = await sqlite.isSecretStored();
  if (stored) return;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const passphrase = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await sqlite.setEncryptionSecret(passphrase);
}

// Connection mode note: the plugin's 'encryption' mode is a one-time
// plaintext→encrypted migration for a database that already exists on disk
// (it fails with "not found" on a fresh install, since there's nothing to
// migrate). 'secret' is the mode for creating/opening a database that's
// encrypted from the moment it's created — that's what we want here.
async function openDb() {
  await ensureWebStore();
  await ensureEncryptionSecret();
  const encrypted = isNative();
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
  const db = isConn
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, encrypted, encrypted ? 'secret' : 'no-encryption', 1, false);
  await db.open();
  await runMigrations(db);
  return db;
}

export function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

// Call after any write when running on web — jeep-sqlite keeps the live DB
// in memory and only persists to IndexedDB on request. Native writes are
// durable immediately, so this is a no-op there.
export async function persist() {
  if (isWeb()) await sqlite.saveToStore(DB_NAME);
}
