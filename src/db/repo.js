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
    `INSERT INTO transactions (id, merchant, account, date, amount, category_id, type, source, created_at, note, sms_address, sms_date)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      txn.note ?? null,
      txn.smsAddress ?? null,
      txn.smsDate ?? null,
    ],
  );
  await persist();
  return id;
}

export async function setTransactionNote(id, note) {
  const db = await getDb();
  await db.run(`UPDATE transactions SET note = ? WHERE id = ?`, [note || null, id]);
  await persist();
}

export async function deleteTransaction(id) {
  const db = await getDb();
  await db.run(`DELETE FROM transactions WHERE id = ?`, [id]);
  await persist();
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

// ── reminders (bills) ──

export async function listReminders() {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM reminders ORDER BY due_day ASC`);
  return res.values ?? [];
}

export async function addReminder({ label, amount, dueDay }) {
  const db = await getDb();
  const id = newId('rem');
  await db.run(
    `INSERT INTO reminders (id, label, amount, due_day, paid_for, created_at) VALUES (?,?,?,?,NULL,?)`,
    [id, label, Math.round(amount), dueDay, Date.now()],
  );
  await persist();
  return id;
}

export async function setReminderPaid(id, paidFor) {
  const db = await getDb();
  await db.run(`UPDATE reminders SET paid_for = ? WHERE id = ?`, [paidFor, id]);
  await persist();
}

export async function deleteReminder(id) {
  const db = await getDb();
  await db.run(`DELETE FROM reminders WHERE id = ?`, [id]);
  await persist();
}

// ── savings goals ──

export async function listGoals() {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM goals ORDER BY created_at ASC`);
  return res.values ?? [];
}

export async function addGoal({ label, targetAmount }) {
  const db = await getDb();
  const id = newId('goal');
  await db.run(
    `INSERT INTO goals (id, label, target_amount, saved_amount, created_at) VALUES (?,?,?,0,?)`,
    [id, label, Math.round(targetAmount), Date.now()],
  );
  await persist();
  return id;
}

export async function addToGoal(id, amount) {
  const db = await getDb();
  await db.run(`UPDATE goals SET saved_amount = saved_amount + ? WHERE id = ?`, [Math.round(amount), id]);
  await persist();
}

export async function deleteGoal(id) {
  const db = await getDb();
  await db.run(`DELETE FROM goals WHERE id = ?`, [id]);
  await persist();
}

// ── net worth (assets / liabilities) ──

export async function listNetWorthItems() {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM net_worth_items ORDER BY created_at ASC`);
  return res.values ?? [];
}

export async function addNetWorthItem({ kind, label, amount }) {
  const db = await getDb();
  const id = newId('nw');
  await db.run(
    `INSERT INTO net_worth_items (id, kind, label, amount, created_at) VALUES (?,?,?,?,?)`,
    [id, kind, label, Math.round(amount), Date.now()],
  );
  await persist();
  return id;
}

export async function deleteNetWorthItem(id) {
  const db = await getDb();
  await db.run(`DELETE FROM net_worth_items WHERE id = ?`, [id]);
  await persist();
}

// ── pattern preferences (confirm / dismiss) ──

export async function listPatternPrefs() {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM pattern_prefs`);
  return res.values ?? [];
}

export async function setPatternPref(signature, status) {
  const db = await getDb();
  await db.run(
    `INSERT INTO pattern_prefs (signature, status) VALUES (?,?)
     ON CONFLICT(signature) DO UPDATE SET status = excluded.status`,
    [signature, status],
  );
  await persist();
}

export async function clearPatternPref(signature) {
  const db = await getDb();
  await db.run(`DELETE FROM pattern_prefs WHERE signature = ?`, [signature]);
  await persist();
}

// ── SMS log ──

export async function listSmsLog(limit = 20) {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM sms_log ORDER BY created_at DESC LIMIT ?`, [limit]);
  return res.values ?? [];
}

export async function addSmsLog({ rawSms, txnId }) {
  const db = await getDb();
  const id = newId('sms');
  await db.run(`INSERT INTO sms_log (id, raw_sms, txn_id, created_at) VALUES (?,?,?,?)`, [id, rawSms, txnId, Date.now()]);
  await persist();
  return id;
}

export async function getRawSmsForTxn(txnId) {
  const db = await getDb();
  const res = await db.query(`SELECT raw_sms FROM sms_log WHERE txn_id = ? LIMIT 1`, [txnId]);
  return res.values?.[0]?.raw_sms ?? null;
}

// ── SMS ignore list (messages the user chose never to import again) ──

export async function listSmsIgnores() {
  const db = await getDb();
  const res = await db.query(`SELECT signature FROM sms_ignores`);
  return (res.values ?? []).map((r) => r.signature);
}

export async function addSmsIgnore(signature) {
  const db = await getDb();
  await db.run(`INSERT OR IGNORE INTO sms_ignores (signature, created_at) VALUES (?,?)`, [signature, Date.now()]);
  await persist();
}

// ── restore from a backup file ──
// Idempotent: uses each row's original id with INSERT OR REPLACE, so restoring
// merges into whatever is already there (re-running a restore won't duplicate).
// This is the real recovery path after a reinstall wipes the local database.
export async function importBackup(data) {
  const db = await getDb();
  const counts = { categories: 0, transactions: 0, budgets: 0, reminders: 0, goals: 0, netWorthItems: 0 };

  for (const c of data.categories ?? []) {
    await db.run(
      `INSERT OR REPLACE INTO categories (id, label, mono, color, is_builtin, sort_order) VALUES (?,?,?,?,?,?)`,
      [c.id, c.label, c.mono, c.color, c.is_builtin ?? 0, c.sort_order ?? 999],
    );
    counts.categories++;
  }
  for (const t of data.transactions ?? []) {
    await db.run(
      `INSERT OR REPLACE INTO transactions (id, merchant, account, date, amount, category_id, type, source, created_at, note, sms_address, sms_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [t.id, t.merchant, t.account ?? null, t.date, Math.round(Math.abs(t.amount)), t.category_id ?? t.cat ?? null, t.type === 'income' ? 'income' : 'expense', t.source ?? 'manual', t.created_at ?? Date.now(), t.note ?? null, t.sms_address ?? null, t.sms_date ?? null],
    );
    counts.transactions++;
  }
  for (const b of data.budgets ?? []) {
    await db.run(
      `INSERT OR REPLACE INTO budgets (category_id, monthly_limit) VALUES (?,?)`,
      [b.category_id ?? b.cat, Math.round(b.monthly_limit ?? b.limit)],
    );
    counts.budgets++;
  }
  for (const r of data.reminders ?? []) {
    await db.run(
      `INSERT OR REPLACE INTO reminders (id, label, amount, due_day, paid_for, created_at) VALUES (?,?,?,?,?,?)`,
      [r.id, r.label, Math.round(r.amount), r.due_day, r.paid_for ?? null, r.created_at ?? Date.now()],
    );
    counts.reminders++;
  }
  for (const g of data.goals ?? []) {
    await db.run(
      `INSERT OR REPLACE INTO goals (id, label, target_amount, saved_amount, created_at) VALUES (?,?,?,?,?)`,
      [g.id, g.label, Math.round(g.target_amount), Math.round(g.saved_amount ?? 0), g.created_at ?? Date.now()],
    );
    counts.goals++;
  }
  for (const n of data.netWorthItems ?? []) {
    await db.run(
      `INSERT OR REPLACE INTO net_worth_items (id, kind, label, amount, created_at) VALUES (?,?,?,?,?)`,
      [n.id, n.kind, n.label, Math.round(n.amount), n.created_at ?? Date.now()],
    );
    counts.netWorthItems++;
  }
  await persist();
  return counts;
}
