import { fmt } from '../utils/currency';
import { payCycleWindow } from '../utils/date';

// Pure derived-value helpers, mirroring the design prototype's renderVals()
// but split out so screens/tests can call them without a live DB connection.

export function categoryById(categories, id) {
  return categories.find((c) => c.id === id) || null;
}

export function alertCount(txns) {
  return txns.filter((t) => !t.cat).length;
}

// When a transaction actually happened: the date chosen for a hand-entered
// row, the SMS timestamp for an imported one, else when it was recorded.
// `date` is only a display label and can't be compared.
export function txnTime(t) {
  return t.occurred_at || t.sms_date || t.created_at || 0;
}

// Limit transactions to a period (e.g. the current pay cycle). Passing no
// window returns everything, which is what the all-time views still want.
export function expiringWarranties(txns, now = new Date()) {
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const expiring = [];

  for (const t of txns) {
    if (!t.warranty_months) continue;
    const occurred = txnTime(t);
    const expireDate = new Date(occurred);
    expireDate.setMonth(expireDate.getMonth() + t.warranty_months);
    const expireMs = expireDate.getTime();

    // Only flag if expiring in the future within 30 days, or expired within the last 7 days
    const diff = expireMs - nowMs;
    if (diff <= ONE_MONTH_MS && diff >= -(7 * 24 * 60 * 60 * 1000)) {
      expiring.push({
        ...t,
        expireDate,
        expireLabel: expireDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
    }
  }

  // Sort by nearest expiration first
  return expiring.sort((a, b) => a.expireDate.getTime() - b.expireDate.getTime());
}

// Expiry + traffic-light status for one warranty. Extended warranty months add
// on top of the base cover. 'expiring' = 60 days or less to run (enough notice
// to buy an extension or squeeze in a last free service).
export function warrantyStatus(purchaseAt, months, extendedMonths = 0, now = new Date()) {
  const total = (Number(months) || 0) + (Number(extendedMonths) || 0);
  const expire = new Date(purchaseAt);
  expire.setMonth(expire.getMonth() + total);
  const DAY = 24 * 60 * 60 * 1000;
  const daysLeft = Math.round((expire.getTime() - now.getTime()) / DAY);
  const status = daysLeft < 0 ? 'expired' : daysLeft <= 60 ? 'expiring' : 'valid';
  return {
    expireDate: expire,
    daysLeft,
    status,
    totalMonths: total,
    expireLabel: expire.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

// One list of every product the household has a warranty on, from both the
// first-class warranties table and any transaction quick-tagged with
// warranty_months. Sorted so what needs attention floats up: still-valid items
// by soonest expiry, expired ones sink to the bottom.
export function warrantyList(warranties, txns, now = new Date()) {
  const items = [];
  for (const w of warranties || []) {
    items.push({
      source: 'warranty', id: w.id, raw: w,
      product: w.product, brand: w.brand || null, amount: w.amount ?? null,
      purchaseAt: w.purchase_at, months: w.warranty_months, extendedMonths: w.extended_months || null,
      store: w.store || null, serial: w.serial || null, photo: w.photo || null, note: w.note || null,
      ...warrantyStatus(w.purchase_at, w.warranty_months, w.extended_months, now),
    });
  }
  for (const t of txns || []) {
    if (!t.warranty_months) continue;
    const pAt = txnTime(t);
    items.push({
      source: 'txn', id: t.id, raw: t,
      product: t.merchant || 'Purchase', brand: null, amount: t.amount ?? null,
      purchaseAt: pAt, months: t.warranty_months, extendedMonths: null,
      store: null, serial: null, photo: null, note: t.note || null,
      ...warrantyStatus(pAt, t.warranty_months, 0, now),
    });
  }
  return items.sort((a, b) => {
    const rank = (x) => (x.status === 'expired' ? 1 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.daysLeft - b.daysLeft;
  });
}

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

export function globalBudgetWarning(txns, budgets, window) {
  if (!budgets || budgets.length === 0) return null;
  const list = inWindow(txns, window);
  const totalSpend = list.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const totalBudgetLimit = budgets.reduce((a, b) => a + (b.monthly_limit || b.limit || 0), 0);

  if (totalBudgetLimit <= 0) return null;

  const pct = (totalSpend / totalBudgetLimit) * 100;
  if (pct >= 90) {
    return {
      pct: Math.round(pct),
      spent: totalSpend,
      limit: totalBudgetLimit,
      exceeded: pct >= 100,
    };
  }
  return null;
}

// Cooling-off for a single large purchase. Unlike globalBudgetWarning this
// needs no budgets — it fires purely on the size of the spend being entered, so
// the impulse guard works for everyone. Returns null when off or under budget.
export function largePurchaseWarning(amount, threshold) {
  const amt = Number(amount) || 0;
  const limit = Number(threshold) || 0;
  if (limit <= 0 || amt < limit) return null;
  return { amount: amt, threshold: limit };
}

// The stretch of time a budget is measured over.
export function budgetWindow(budget, salaryDay = 0, now = new Date()) {
  if (budget.period === 'custom' && budget.endsAt) {
    return { start: new Date(budget.startsAt || now), end: new Date(budget.endsAt), kind: 'custom' };
  }
  if (budget.period === 'cycle') {
    const w = payCycleWindow(salaryDay, now);
    return { start: w.start, end: w.end, kind: 'cycle' };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    kind: 'month',
  };
}

const DAY_MS = 86400000;

export function budgetRows(txns, categories, budgets, { salaryDay = 0, now = new Date() } = {}) {
  return budgets.map((b) => {
    const cat = categoryById(categories, b.cat);
    const win = budgetWindow(b, salaryDay, now);
    // Only spending inside the window counts. Previously every transaction
    // ever recorded was summed, so a budget could never actually reset.
    const spent = inWindow(txns, win)
      .filter((t) => t.type === 'expense' && t.cat === b.cat)
      .reduce((a, t) => a + t.amount, 0);

    const pct = b.limit ? Math.round((spent / b.limit) * 100) : 0;
    const over = spent > b.limit;
    const near = !over && pct >= 80;
    const remaining = Math.max(0, b.limit - spent);

    // Days left counts today as usable, so a budget on its final day still
    // shows what's spendable rather than zero.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysLeft = Math.max(0, Math.ceil((win.end - today) / DAY_MS));
    // Overspending shrinks tomorrow's allowance automatically: less money is
    // divided across fewer days, so the figure self-corrects each day.
    const perDay = daysLeft > 0 ? Math.floor(remaining / daysLeft) : remaining;
    const totalDays = Math.max(1, Math.round((win.end - win.start) / DAY_MS));
    const idealPace = Math.round((b.limit / totalDays) * Math.max(0, totalDays - daysLeft));
    const aheadOfPace = spent > idealPace;

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
      period: b.period || 'month',
      window: win,
      daysLeft,
      remaining,
      perDay,
      perDayF: fmt(perDay),
      aheadOfPace,
      // The one-line verdict shown under the bar.
      paceText: over
        ? 'Nothing left in this budget'
        : daysLeft <= 0
          ? `${fmt(remaining)} unspent`
          : `${fmt(perDay)}/day for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}`,
    };
  });
}

// A starting limit suggested from what the category actually costs: the mean
// of the last three complete months, so it's grounded rather than guessed.
export function suggestedLimit(txns, catId, now = new Date()) {
  let total = 0;
  let months = 0;
  for (let i = 1; i <= 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const sum = inWindow(txns, { start, end })
      .filter((t) => t.type === 'expense' && t.cat === catId)
      .reduce((a, t) => a + t.amount, 0);
    if (sum > 0) {
      total += sum;
      months += 1;
    }
  }
  if (!months) return 0;
  // Rounded to the nearest 100 so the suggestion reads as a decision, not a
  // computed artefact like Rs.3,847.
  return Math.max(100, Math.round(total / months / 100) * 100);
}

// ── savings goals ──

const MONTH_MS = 2592000000; // 30 days — an "average" month, good enough for pace

// Derived view of one goal: progress, and — from how long it's been open and how
// much is saved — the pace you're actually keeping versus the pace a deadline
// needs. Everything the screen shows is computed here so it stays testable.
export function goalRow(goal, now = new Date()) {
  const saved = goal.saved_amount || 0;
  const target = goal.target_amount || 0;
  const remaining = Math.max(0, target - saved);
  const pct = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const reached = target > 0 && saved >= target;

  // How fast money has actually gone in, on average, since the goal was created.
  const monthsOpen = Math.max(0.5, (now.getTime() - (goal.created_at || now.getTime())) / MONTH_MS);
  const avgPerMonth = Math.round(saved / monthsOpen);

  const deadline = goal.target_date ? new Date(goal.target_date) : null;
  let needPerMonth = null;
  let daysLeft = null;
  let onTrack = null;
  let deadlineLabel = null;
  if (deadline) {
    deadlineLabel = deadline.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    daysLeft = Math.round((deadline - today) / DAY_MS);
    const monthsLeft = (deadline - now) / MONTH_MS;
    needPerMonth = monthsLeft > 0 ? Math.round(remaining / monthsLeft) : remaining;
    // On pace if you're already putting away at least what the deadline needs.
    onTrack = reached || (monthsLeft > 0 && avgPerMonth >= needPerMonth);
  }

  // Projected finish date at the current average pace (no deadline case).
  let projectedLabel = null;
  if (!reached && remaining > 0 && avgPerMonth > 0) {
    const proj = new Date(now.getTime() + (remaining / avgPerMonth) * MONTH_MS);
    projectedLabel = proj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }

  // One-line verdict shown under the bar.
  let paceText;
  if (reached) {
    paceText = 'Reached — well done 🎉';
  } else if (deadline) {
    if (daysLeft <= 0) {
      paceText = `Deadline passed · ${fmt(remaining)} to go`;
    } else {
      paceText = `Save ${fmt(needPerMonth)}/mo to reach it by ${deadlineLabel}`;
    }
  } else if (avgPerMonth > 0) {
    paceText = projectedLabel ? `Saving ~${fmt(avgPerMonth)}/mo · on track for ${projectedLabel}` : `Saving ~${fmt(avgPerMonth)}/mo`;
  } else {
    paceText = `${fmt(remaining)} to go`;
  }

  return {
    id: goal.id,
    label: goal.label,
    saved,
    target,
    remaining,
    pct,
    reached,
    savedF: fmt(saved),
    targetF: fmt(target),
    remainingF: fmt(remaining),
    avgPerMonth,
    avgPerMonthF: fmt(avgPerMonth),
    needPerMonth,
    needPerMonthF: needPerMonth == null ? null : fmt(needPerMonth),
    deadline: goal.target_date || null,
    deadlineLabel,
    daysLeft,
    onTrack,
    projectedLabel,
    paceText,
  };
}

// Roll-up for the Home card: overall progress across every goal.
export function goalsSummary(goals, now = new Date()) {
  const rows = goals.map((g) => goalRow(g, now));
  const totalSaved = rows.reduce((a, r) => a + r.saved, 0);
  const totalTarget = rows.reduce((a, r) => a + r.target, 0);
  const pct = totalTarget ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  return {
    count: rows.length,
    rows,
    totalSaved,
    totalTarget,
    pct,
    totalSavedF: fmt(totalSaved),
    totalTargetF: fmt(totalTarget),
    behind: rows.filter((r) => r.onTrack === false).length,
  };
}

// ── recurring bills / EMIs / subscriptions ──

// Type-specific derived view of one reminder. For an EMI: how many instalments
// are paid, how many remain, and the payoff date. For a subscription: the
// annualised cost and billing cadence. Plain bills carry no extra info.
export function billRow(r, now = new Date()) {
  const kind = r.kind || 'bill';
  const dueDay = r.due_day || 1;
  const base = { id: r.id, kind, label: r.label, amount: r.amount, amountF: fmt(r.amount), dueDay };

  // Both EMIs and fixed-run bills have a duration (term_count) and therefore a
  // progress bar. Shared math: how many instalments/months have already come
  // due, how many are left, and when it finishes.
  const hasTerm = (kind === 'emi' || kind === 'bill') && (r.term_count || 0) > 0;
  if (hasTerm) {
    const total = r.term_count || 0;
    const start = new Date(r.start_at || r.created_at || now.getTime());
    const monthsBetween = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    // Instalments whose due date has already arrived, counting this month's only
    // once its day has passed.
    let paid = monthsBetween + (now.getDate() >= dueDay ? 1 : 0);
    paid = Math.max(0, Math.min(total, paid));
    const remaining = Math.max(0, total - paid);
    // Last instalment falls (total-1) months after the first.
    const payoff = new Date(start.getFullYear(), start.getMonth() + Math.max(0, total - 1), dueDay);
    const payoffLabel = payoff.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const pct = total ? Math.round((paid / total) * 100) : 0;
    const isEmi = kind === 'emi';
    const unitDone = isEmi ? 'paid' : 'done';
    return {
      ...base,
      typeLabel: isEmi ? 'EMI' : 'Bill',
      badge: isEmi ? 'EMI' : `${total}MO`,
      hasProgress: true,
      total,
      paid,
      remaining,
      pct,
      payoffLabel,
      typeText: `${paid} of ${total} ${unitDone} · ${remaining} left · ${isEmi ? 'payoff' : 'ends'} ${payoffLabel}`,
    };
  }

  if (kind === 'subscription') {
    const yearly = r.cadence === 'yearly';
    const annual = yearly ? r.amount : r.amount * 12;
    return {
      ...base,
      typeLabel: 'Subscription',
      badge: 'SUB',
      yearly,
      annual,
      annualF: fmt(annual),
      typeText: `≈${fmt(annual)}/yr · billed ${yearly ? 'yearly' : 'monthly'}`,
    };
  }

  return { ...base, typeLabel: 'Bill', badge: null, typeText: null };
}

// Finds transactions that are the same bank SMS imported more than once. A real
// duplicate shares the exact SMS timestamp + amount + direction — a fingerprint
// two genuinely different payments would never share. Only SMS-sourced rows are
// considered; hand-entered cash is never touched (two ₹100 cash entries can be
// legitimately different). Returns the ids to remove, keeping the best copy of
// each group (a categorised one over an uncategorised one, else the earliest).
export function duplicateTxnIds(txns) {
  const groups = {};
  for (const t of txns) {
    if (t.source !== 'sms' || !t.sms_date) continue;
    const key = `${t.sms_date}|${t.amount}|${t.type}`;
    (groups[key] = groups[key] || []).push(t);
  }
  const remove = [];
  for (const key in groups) {
    const g = groups[key];
    if (g.length < 2) continue;
    g.sort((a, b) => {
      const ac = a.cat ? 1 : 0;
      const bc = b.cat ? 1 : 0;
      if (ac !== bc) return bc - ac; // keep a categorised copy first
      return (a.created_at || 0) - (b.created_at || 0); // else the earliest
    });
    for (let i = 1; i < g.length; i++) remove.push(g[i].id);
  }
  return remove;
}

// ── drill-down dashboard ──

// Everything the reusable detail screen shows for one spending category:
// a headline for the current cycle, this-vs-last comparison, a 6-month trend,
// the top merchants, and the full transaction list. Pure, so it's testable.
export function categoryDetail(txns, categories, catId, { salaryDay = 0, now = new Date() } = {}) {
  const cat = categoryById(categories, catId);
  const catTxns = txns.filter((t) => t.type === 'expense' && t.cat === catId);

  const cycle = payCycleWindow(salaryDay, now);
  // A moment inside the previous cycle = one day before this cycle started.
  const prevCycle = payCycleWindow(salaryDay, new Date(+cycle.start - DAY_MS));
  const thisTotal = inWindow(catTxns, cycle).reduce((a, t) => a + t.amount, 0);
  const lastTotal = inWindow(catTxns, prevCycle).reduce((a, t) => a + t.amount, 0);
  const delta = thisTotal - lastTotal;

  // Last 6 calendar months, oldest → newest, for a small bar chart.
  const trend = [];
  let maxMonth = 0;
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = inWindow(catTxns, { start, end }).reduce((a, t) => a + t.amount, 0);
    trend.push({ label: start.toLocaleDateString('en-IN', { month: 'short' }), total });
    if (total > maxMonth) maxMonth = total;
  }
  const trendBars = trend.map((m) => ({ ...m, pct: maxMonth ? Math.max(2, Math.round((m.total / maxMonth) * 100)) : 0, totalF: fmt(m.total) }));

  // Top merchants across all time in this category.
  const byMerchant = {};
  catTxns.forEach((t) => {
    const k = (t.merchant || '—').trim().toLowerCase();
    if (!byMerchant[k]) byMerchant[k] = { merchant: t.merchant || '—', count: 0, total: 0 };
    byMerchant[k].count += 1;
    byMerchant[k].total += t.amount;
  });
  const topMerchants = Object.values(byMerchant)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((m) => ({ ...m, totalF: fmt(m.total) }));

  const list = [...catTxns].sort((a, b) => txnTime(b) - txnTime(a));
  const allTimeTotal = catTxns.reduce((a, t) => a + t.amount, 0);

  return {
    kind: 'category',
    id: catId,
    title: cat?.label ?? 'Category',
    color: cat?.color ?? '#8A8577',
    mono: cat?.mono ?? '?',
    cycleLabel: cycle.calendar ? 'this month' : 'this cycle',
    thisTotal,
    lastTotal,
    delta,
    thisTotalF: fmt(thisTotal),
    lastTotalF: fmt(lastTotal),
    deltaF: fmt(Math.abs(delta)),
    deltaUp: delta > 0,
    trend: trendBars,
    topMerchants,
    txns: list,
    count: catTxns.length,
    allTimeTotalF: fmt(allTimeTotal),
  };
}

// Everything the detail screen shows for one detected pattern (a merchant seen
// 3+ times): the evidence behind the flag and every transaction in it.
export function patternDetail(txns, categories, signature, now = new Date()) {
  const matches = txns.filter((t) => t.type === 'expense' && (t.merchant || '').trim().toLowerCase() === signature);
  const merchant = matches[0]?.merchant || signature;

  // Most common category among the matches decides the icon/colour.
  const catCounts = {};
  matches.forEach((t) => { if (t.cat) catCounts[t.cat] = (catCounts[t.cat] || 0) + 1; });
  const topCatId = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const cat = categoryById(categories, topCatId);

  const total = matches.reduce((a, t) => a + t.amount, 0);
  const avg = matches.length ? Math.round(total / matches.length) : 0;
  const times = matches.map(txnTime).filter(Boolean).sort((a, b) => a - b);
  const firstSeen = times[0] ? new Date(times[0]) : null;
  const lastSeen = times[times.length - 1] ? new Date(times[times.length - 1]) : null;
  const dateLabel = (d) => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  // 6-month trend of this merchant's spend.
  const trend = [];
  let maxMonth = 0;
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const t = inWindow(matches, { start, end }).reduce((a, x) => a + x.amount, 0);
    trend.push({ label: start.toLocaleDateString('en-IN', { month: 'short' }), total: t });
    if (t > maxMonth) maxMonth = t;
  }
  const trendBars = trend.map((m) => ({ ...m, pct: maxMonth ? Math.max(2, Math.round((m.total / maxMonth) * 100)) : 0, totalF: fmt(m.total) }));

  const list = [...matches].sort((a, b) => txnTime(b) - txnTime(a));

  return {
    kind: 'pattern',
    id: signature,
    title: merchant,
    color: cat?.color ?? '#8A8577',
    mono: cat?.mono ?? '?',
    categoryLabel: cat?.label ?? 'Uncategorised',
    count: matches.length,
    totalF: fmt(total),
    avgF: fmt(avg),
    firstSeenLabel: dateLabel(firstSeen),
    lastSeenLabel: dateLabel(lastSeen),
    whyText: `Flagged because you've paid ${merchant} ${matches.length} times. Budget Tracker highlights any merchant you pay 3 or more times, so recurring spending doesn't slip past you.`,
    trend: trendBars,
    txns: list,
  };
}

export function filterTransactions(txns, { search = '', filter = 'all', categories = [] } = {}) {
  const q = search.trim().toLowerCase();
  let list = txns;
  if (q) {
    // Match the payee, the note, the category name, or the amount — typing
    // "60807" finds a payment even when its name is generic like "Credit", and
    // "food" finds everything filed under Food & Dining.
    const qDigits = q.replace(/[^\d]/g, '');
    const catLabel = Object.fromEntries((categories || []).map((c) => [c.id, (c.label || '').toLowerCase()]));
    list = list.filter(
      (t) =>
        (t.merchant || '').toLowerCase().includes(q) ||
        (t.note || '').toLowerCase().includes(q) ||
        (t.cat && (catLabel[t.cat] || '').includes(q)) ||
        (qDigits && String(t.amount).includes(qDigits)),
    );
  }
  if (filter === 'review') list = list.filter((t) => !t.cat);
  if (filter === 'business') list = list.filter((t) => t.business);
  if (filter === 'personal') list = list.filter((t) => !t.business);
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
        cat: g.cat ?? null,
        label: cat?.label ?? 'Uncategorised',
        mono: cat?.mono ?? '?',
        color: cat?.color ?? '#8A8577',
        confirmed: prefByMerchant[sig] === 'confirmed',
      };
    })
    .sort((a, b) => b.count - a.count);
}

// ── side-hustle / business ──

// Business spending split out from household, with the GST paid on it (the
// input credit a freelancer claims back). `gst_rate` is a percentage on the
// gross amount, so the tax component is amount × rate / (100 + rate).
export function businessSummary(txns, window) {
  const list = inWindow(txns, window).filter((t) => t.business);
  const expenses = list.filter((t) => t.type === 'expense');
  const income = list.filter((t) => t.type === 'income');
  const spend = expenses.reduce((a, t) => a + t.amount, 0);
  const earned = income.reduce((a, t) => a + t.amount, 0);
  const gst = expenses.reduce((a, t) => {
    const rate = Number(t.gst_rate) || 0;
    return rate > 0 ? a + Math.round((t.amount * rate) / (100 + rate)) : a;
  }, 0);
  return { count: list.length, spend, earned, net: earned - spend, gst };
}

// ── net worth projection ──

// Straight-line forecast: today's net worth plus the average monthly surplus,
// carried forward. Deliberately not a market prediction — it answers "if I keep
// saving what I've been saving, where do I land?" and nothing more.
export function netWorthProjection(items, txns, { months = 12, lookbackMonths = 6, now = new Date() } = {}) {
  const assets = (items || []).filter((i) => i.kind === 'asset').reduce((a, i) => a + i.amount, 0);
  const liabilities = (items || []).filter((i) => i.kind === 'liability').reduce((a, i) => a + i.amount, 0);
  const current = assets - liabilities;

  const from = new Date(now.getFullYear(), now.getMonth() - lookbackMonths, 1).getTime();
  const recent = (txns || []).filter((t) => txnTime(t) >= from);
  const income = recent.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const spend = recent.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  // Count only months that actually have data, so a new user isn't averaged
  // against empty months and told they save nothing.
  const monthsSeen = Math.max(1, Math.min(lookbackMonths, monthsSpanned(recent, now)));
  const monthlySurplus = Math.round((income - spend) / monthsSeen);

  const points = [];
  for (let m = 0; m <= months; m += 1) {
    points.push({ month: m, value: current + monthlySurplus * m });
  }
  return {
    current,
    assets,
    liabilities,
    monthlySurplus,
    monthsSeen,
    hasData: recent.length > 0,
    projected: current + monthlySurplus * months,
    horizonMonths: months,
    points,
  };
}

function monthsSpanned(txns, now) {
  if (!txns.length) return 1;
  const oldest = Math.min(...txns.map(txnTime));
  const d = new Date(oldest);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) + 1;
}

// ── spending forecast (pace) ──

// Where this budget lands if you keep spending at the pace you have so far.
// Pure extrapolation, not a prediction of behaviour.
export function spendingForecast(txns, budgets, categories, { salaryDay = 0, now = new Date() } = {}) {
  const rows = budgetRows(txns, categories, budgets, { salaryDay, now });
  return rows
    .map((r) => {
      const w = budgetWindow({ period: r.period, startsAt: r.startsAt, endsAt: r.endsAt }, salaryDay, now);
      const total = Math.max(1, w.end - w.start);
      const elapsed = Math.min(total, Math.max(0, now.getTime() - +w.start));
      const fraction = elapsed / total;
      // Too early in the period for a projection to mean anything.
      if (fraction < 0.15) return null;
      const projected = Math.round(r.spent / fraction);
      const over = projected - r.limit;
      return { ...r, projected, over, fraction, daysLeft: Math.ceil((+w.end - now.getTime()) / 86400000) };
    })
    .filter((r) => r && r.over > 0)
    .sort((a, b) => b.over - a.over);
}

// ── subscription price changes ──

// A subscription whose real charges no longer match the amount on the reminder.
// We can't negotiate a bill down, but we can notice when one quietly goes up.
export function subscriptionPriceChanges(reminders, txns) {
  const out = [];
  for (const r of reminders || []) {
    if ((r.kind || '') !== 'subscription') continue;
    const needle = (r.label || '').toLowerCase().trim();
    if (needle.length < 3) continue;
    const charges = (txns || [])
      .filter((t) => t.type === 'expense' && (t.merchant || '').toLowerCase().includes(needle))
      .sort((a, b) => txnTime(b) - txnTime(a));
    if (!charges.length) continue;
    const latest = charges[0].amount;
    // A rounding wobble isn't a price rise — require a real, visible jump.
    const diff = latest - r.amount;
    if (diff > 0 && diff / r.amount >= 0.02) {
      out.push({
        id: r.id,
        label: r.label,
        was: r.amount,
        now: latest,
        rise: diff,
        pct: Math.round((diff / r.amount) * 100),
        yearlyImpact: diff * (r.cadence === 'yearly' ? 1 : 12),
        at: txnTime(charges[0]),
      });
    }
  }
  return out.sort((a, b) => b.yearlyImpact - a.yearlyImpact);
}

// ── zero-based envelopes ──

export function periodKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function prevPeriodKey(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return periodKeyOf(d);
}

function monthWindowOf(key) {
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

// What's actually left in an envelope this month: whatever rolled over from
// last month, plus what you assigned now, minus what you spent. The rollover is
// the whole point — unspent money stays yours instead of resetting, and an
// overspend follows you into next month so it has to be dealt with.
export function envelopeRows(txns, categories, envelopes, periodKey = periodKeyOf(), { depth = 12 } = {}) {
  const assignedFor = (catId, key) =>
    (envelopes || []).find((e) => e.category_id === catId && e.period_key === key)?.assigned ?? 0;

  const spentFor = (catId, key) => {
    const w = monthWindowOf(key);
    return inWindow(txns, w)
      .filter((t) => t.type === 'expense' && t.cat === catId)
      .reduce((a, t) => a + t.amount, 0);
  };

  // Walk back a bounded number of months so a long history can't make this
  // quadratic — anything older is treated as settled.
  const carriedInto = (catId, key) => {
    const keys = [];
    let k = prevPeriodKey(key);
    for (let i = 0; i < depth; i += 1) { keys.unshift(k); k = prevPeriodKey(k); }
    let balance = 0;
    for (const pk of keys) {
      const a = assignedFor(catId, pk);
      if (a === 0 && balance === 0) continue;
      balance = balance + a - spentFor(catId, pk);
    }
    return balance;
  };

  const active = (categories || []).filter(
    (c) => c.id !== 'income' && (assignedFor(c.id, periodKey) > 0 || spentFor(c.id, periodKey) > 0 || carriedInto(c.id, periodKey) !== 0),
  );

  return active.map((c) => {
    const carried = carriedInto(c.id, periodKey);
    const assigned = assignedFor(c.id, periodKey);
    const spent = spentFor(c.id, periodKey);
    const available = carried + assigned - spent;
    return {
      catId: c.id,
      label: c.label,
      color: c.color,
      mono: c.mono,
      carried,
      assigned,
      spent,
      available,
      overspent: available < 0,
    };
  }).sort((a, b) => a.available - b.available);
}

// The "give every rupee a job" number: money that has arrived but hasn't been
// assigned to anything yet. Income for the month, less everything assigned,
// plus whatever rolled over unspent.
export function toBeAssigned(txns, categories, envelopes, periodKey = periodKeyOf()) {
  const w = monthWindowOf(periodKey);
  const income = inWindow(txns, w).filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const assigned = (envelopes || [])
    .filter((e) => e.period_key === periodKey)
    .reduce((a, e) => a + (e.assigned || 0), 0);
  const rows = envelopeRows(txns, categories, envelopes, periodKey);
  const carried = rows.reduce((a, r) => a + r.carried, 0);
  return { income, assigned, carried, unassigned: income + carried - assigned };
}
