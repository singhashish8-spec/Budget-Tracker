import { getDb, persist } from './sqlite';
import { newId } from '../utils/id';

// Thin data-access layer over the SQLite tables. Screens/state never touch
// getDb()/raw SQL directly — everything funnels through here so the storage
// backend (native SQLite vs. web jeep-sqlite) stays swappable.

export async function listCategories() {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM categories ORDER BY sort_order ASC, label ASC`);
  return res.values ?? [];
}

export async function addCategory({ label, mono, color }) {
  const db = await getDb();
  const id = newId('cat');
  await db.run(
    `INSERT INTO categories (id, label, mono, color, is_builtin, sort_order) VALUES (?,?,?,?,0,999)`,
    [id, label, mono, color],
  );
  await persist();
  return id;
}

export async function listTransactions() {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM transactions ORDER BY created_at DESC`);
  return (res.values ?? []).map((t) => ({ ...t, cat: t.category_id }));
}

export async function addTransaction(txn) {
  const db = await getDb();
  const id = txn.id || newId('txn');
  await db.run(
    `INSERT INTO transactions (id, merchant, account, date, amount, category_id, type, source, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      txn.merchant,
      txn.account ?? null,
      txn.date,
      Math.round(Math.abs(txn.amount)),
      txn.cat ?? null,
      txn.type === 'income' ? 'income' : 'expense',
      txn.source ?? 'manual',
      Date.now(),
    ],
  );
  await persist();
  return id;
}

export async function addTransactions(txns) {
  for (const t of txns) await addTransaction(t);
}

export async function setTransactionCategory(id, categoryId) {
  const db = await getDb();
  await db.run(`UPDATE transactions SET category_id = ? WHERE id = ?`, [categoryId, id]);
  await persist();
}

export async function listBudgets() {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM budgets`);
  return (res.values ?? []).map((b) => ({ cat: b.category_id, limit: b.monthly_limit }));
}

export async function upsertBudget(categoryId, monthlyLimit) {
  const db = await getDb();
  await db.run(
    `INSERT INTO budgets (category_id, monthly_limit) VALUES (?,?)
     ON CONFLICT(category_id) DO UPDATE SET monthly_limit = excluded.monthly_limit`,
    [categoryId, Math.round(monthlyLimit)],
  );
  await persist();
}

export async function getSetting(key, fallback = null) {
  const db = await getDb();
  const res = await db.query(`SELECT value FROM settings WHERE key = ?`, [key]);
  const row = res.values?.[0];
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)],
  );
  await persist();
}
