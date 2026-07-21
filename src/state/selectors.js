import { fmt } from '../utils/currency';

// Pure derived-value helpers, mirroring the design prototype's renderVals()
// but split out so screens/tests can call them without a live DB connection.

export function categoryById(categories, id) {
  return categories.find((c) => c.id === id) || null;
}

export function alertCount(txns) {
  return txns.filter((t) => !t.cat).length;
}

// When a transaction actually happened: the SMS timestamp for imported rows,
// falling back to when it was recorded. `date` is only a display label.
export function txnTime(t) {
  return t.sms_date || t.created_at || 0;
}

// Limit transactions to a period (e.g. the current pay cycle). Passing no
// window returns everything, which is what the all-time views still want.
export function inWindow(txns, window) {
  if (!window) return txns;
  const from = +window.start;
  const to = +window.end;
  return txns.filter((t) => {
    const ts = txnTime(t);
    return ts >= from && ts < to;
  });
}

export function spendByCategory(txns) {
  const byCat = {};
  txns
    .filter((t) => t.type === 'expense' && t.cat)
    .forEach((t) => {
      byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
    });
  return byCat;
}

export function topCategories(txns, categories, limit = 4) {
  const byCat = spendByCategory(txns);
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = sorted.length ? sorted[0][1] : 1;
  return sorted.map(([id, amt]) => {
    const cat = categoryById(categories, id);
    return {
      id,
      label: cat?.label ?? id,
      mono: cat?.mono ?? '?',
      color: cat?.color ?? '#8A8577',
      amount: amt,
      amtF: fmt(amt),
      barPct: Math.max(6, Math.round((amt / max) * 100)),
    };
  });
}

// Totals for the period shown on Home. Previously this summed EVERY
// transaction ever recorded while the card claimed "spent this month" — passing
// the pay-cycle window makes the number mean what the label says.
export function homeTotals(txns, window) {
  const list = inWindow(txns, window);
  const spend = list.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const income = list.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const spendPct = income ? Math.min(100, Math.round((spend / income) * 100)) : 0;
  return { spend, income, spendPct };
}

export function budgetRows(txns, categories, budgets) {
  const byCat = spendByCategory(txns);
  return budgets.map((b) => {
    const cat = categoryById(categories, b.cat);
    const spent = byCat[b.cat] || 0;
    const pct = b.limit ? Math.round((spent / b.limit) * 100) : 0;
    const over = spent > b.limit;
    const near = !over && pct >= 80;
    return {
      cat: b.cat,
      label: cat?.label ?? b.cat,
      mono: cat?.mono ?? '?',
      color: cat?.color ?? '#8A8577',
      spent,
      limit: b.limit,
      spentF: fmt(spent),
      limitF: fmt(b.limit),
      barPct: Math.min(100, pct),
      status: over ? 'over' : near ? 'near' : 'ok',
      statusText: over
        ? `Over by ${fmt(spent - b.limit)}`
        : `${fmt(b.limit - spent)} left${near ? ' — almost there' : ''}`,
    };
  });
}

export function filterTransactions(txns, { search = '', filter = 'all' } = {}) {
  const q = search.trim().toLowerCase();
  let list = txns;
  if (q) {
    // Match the payee, the note, or the amount — typing "60807" should find a
    // payment even when its name is something generic like "Credit".
    const qDigits = q.replace(/[^\d]/g, '');
    list = list.filter(
      (t) =>
        (t.merchant || '').toLowerCase().includes(q) ||
        (t.note || '').toLowerCase().includes(q) ||
        (qDigits && String(t.amount).includes(qDigits)),
    );
  }
  if (filter === 'review') list = list.filter((t) => !t.cat);
  return list;
}

// Groups expense transactions by merchant, surfaces the ones seen 3+ times as
// a "pattern" (real detection over stored data — the design prototype used
// hardcoded demo patterns). signature = normalized merchant name, used as the
// pattern_prefs primary key so confirm/dismiss survives across app opens.
export function detectPatterns(txns, categories, patternPrefs) {
  const prefByMerchant = {};
  patternPrefs.forEach((p) => {
    prefByMerchant[p.signature] = p.status;
  });

  const groups = {};
  txns
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const key = t.merchant.trim().toLowerCase();
      if (!groups[key]) groups[key] = { merchant: t.merchant, count: 0, total: 0, cat: t.cat };
      groups[key].count += 1;
      groups[key].total += t.amount;
    });

  return Object.entries(groups)
    .filter(([sig, g]) => g.count >= 3 && prefByMerchant[sig] !== 'dismissed')
    .map(([sig, g]) => {
      const cat = categoryById(categories, g.cat);
      const avg = Math.round(g.total / g.count);
      return {
        signature: sig,
        merchant: g.merchant,
        count: g.count,
        avgAmount: avg,
        avgF: fmt(avg),
        totalF: fmt(g.total),
        label: cat?.label ?? 'Uncategorised',
        mono: cat?.mono ?? '?',
        color: cat?.color ?? '#8A8577',
        confirmed: prefByMerchant[sig] === 'confirmed',
      };
    })
    .sort((a, b) => b.count - a.count);
}
