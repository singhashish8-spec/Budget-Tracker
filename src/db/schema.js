// Versioned migrations, applied in order. Each migration's statements run once,
// tracked via the schema_meta table — mirrors the blueprint's "Schema Version
// Management" / "Automated Database Migrations" requirement so future columns
// (location, custom recurrence, etc.) can be added without touching past rows.

export const MIGRATIONS = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        mono TEXT NOT NULL,
        color TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      );`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        merchant TEXT NOT NULL,
        account TEXT,
        date TEXT NOT NULL,
        amount INTEGER NOT NULL,
        category_id TEXT REFERENCES categories(id),
        type TEXT NOT NULL CHECK(type IN ('expense','income')),
        source TEXT NOT NULL DEFAULT 'manual',
        created_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);`,
      `CREATE TABLE IF NOT EXISTS budgets (
        category_id TEXT PRIMARY KEY REFERENCES categories(id),
        monthly_limit INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        amount INTEGER NOT NULL,
        due_day INTEGER NOT NULL,
        paid_for TEXT,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        target_amount INTEGER NOT NULL,
        saved_amount INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS net_worth_items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK(kind IN ('asset','liability')),
        label TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS pattern_prefs (
        signature TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK(status IN ('confirmed','dismissed'))
      );`,
      `CREATE TABLE IF NOT EXISTS sms_log (
        id TEXT PRIMARY KEY,
        raw_sms TEXT NOT NULL,
        txn_id TEXT REFERENCES transactions(id),
        created_at INTEGER NOT NULL
      );`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export const BUILTIN_CATEGORIES = [
  { id: 'food', label: 'Food & Dining', mono: 'FD', color: '#C2622E' },
  { id: 'groceries', label: 'Groceries', mono: 'GR', color: '#6B8F3C' },
  { id: 'transport', label: 'Transport', mono: 'TR', color: '#2D6E8F' },
  { id: 'rent', label: 'Rent & Housing', mono: 'RN', color: '#7A5C9E' },
  { id: 'utilities', label: 'Utilities', mono: 'UT', color: '#B8892B' },
  { id: 'shopping', label: 'Shopping', mono: 'SH', color: '#C24D6B' },
  { id: 'health', label: 'Health', mono: 'HE', color: '#1E8F72' },
  { id: 'entertainment', label: 'Entertainment', mono: 'EN', color: '#8F4D9E' },
  { id: 'emi', label: 'EMI & Loans', mono: 'EL', color: '#A13B3B' },
  { id: 'invest', label: 'Investments', mono: 'IN', color: '#0E6E4F' },
  { id: 'subscriptions', label: 'Subscriptions', mono: 'SU', color: '#5B6B8F' },
  { id: 'income', label: 'Income', mono: 'CR', color: '#2F8F4D' },
  { id: 'transfer', label: 'Transfers', mono: 'TF', color: '#6B7280' },
  { id: 'other', label: 'Others', mono: 'OT', color: '#8A8577' },
];
