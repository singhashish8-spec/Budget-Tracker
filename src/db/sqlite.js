import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { MIGRATIONS, LATEST_SCHEMA_VERSION, BUILTIN_CATEGORIES } from './schema';

// Financial transaction history lives here. On native this is a real SQLite
// file in app-private storage; in the browser (dev / `npm run dev`) it's
// backed by jeep-sqlite + sql.js (IndexedDB-persisted) so the same code path
// works without a device. Neither is encrypted at rest yet — see README
// "Known gaps" for the production requirement to layer in SQLCipher via the
// plugin's `encrypted` connection mode before shipping.

const DB_NAME = 'budget_tracker';
const sqlite = new SQLiteConnection(CapacitorSQLite);
const isWeb = () => Capacitor.getPlatform() === 'web';

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

async function runMigrations(db) {
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

// Call after any write when running on web — jeep-sqlite keeps the live DB
// in memory and only persists to IndexedDB on request. Native writes are
// durable immediately, so this is a no-op there.
export async function persist() {
  if (isWeb()) await sqlite.saveToStore(DB_NAME);
}
