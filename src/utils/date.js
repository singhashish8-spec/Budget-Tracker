export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthLabel(d = new Date()) {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Adds `months` to a date, clamping the day-of-month to the target month's
// actual length instead of letting it overflow into the month after. JS's
// own `Date#setMonth` doesn't do this: Jan 31 + 1 month rolls past a
// 28-day February into March 3, not "end of February" — the naive
// `d.setMonth(d.getMonth() + months)` pattern used to do exactly that for
// warranty-expiry and EMI-payoff dates, throwing both off by several days
// for anything starting on the 29th–31st. Resetting the day to 1 before
// changing the month sidesteps the overflow entirely; only then is the day
// restored, clamped to what the target month actually has.
export function addMonthsClamped(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, lastDayOfMonth(d.getFullYear(), d.getMonth())));
  return d;
}

// Resolve a salaryDay code (1-31, or 32 = last day) to an actual date in a
// given year/month, clamping to that month's length (e.g. day 31 in Feb → 28/29).
function resolvePayday(year, month, salaryDay) {
  const last = lastDayOfMonth(year, month);
  const day = salaryDay === 32 ? last : Math.min(salaryDay, last);
  return new Date(year, month, day);
}

// The pay cycle containing `now`: runs from this month's payday up to the day
// before next month's payday. salaryDay 0 → falls back to the calendar month.
export function payCycleWindow(salaryDay, now = new Date()) {
  if (!salaryDay) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end, calendar: true };
  }
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisPayday = resolvePayday(y, m, salaryDay);
  let start;
  if (now >= thisPayday) {
    start = thisPayday;
  } else {
    start = resolvePayday(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, salaryDay);
  }
  const end = resolvePayday(start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear(), (start.getMonth() + 1) % 12, salaryDay);
  return { start, end, calendar: false };
}

// Days from `now` until the next payday (0 if today is payday).
export function daysUntilPayday(salaryDay, now = new Date()) {
  if (!salaryDay) return null;
  const { end } = payCycleWindow(salaryDay, now);
  const ms = end - new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round(ms / 86400000));
}

// When a transaction happened, as a short human label with the time of day.
// Prefers the original SMS timestamp; `date` on the row is only ever a display
// string ("16 Jun") with no year or time, so it's the last resort.
export function txnWhen(t) {
  const ms = t?.occurred_at || t?.sms_date || t?.created_at;
  if (!ms) return t?.date || '';
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const daysApart = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (daysApart === 0) return `Today, ${time}`;
  if (daysApart === 1) return `Yesterday, ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const day = d.toLocaleDateString('en-IN', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day}, ${time}`;
}

export function salaryDayLabel(salaryDay) {
  if (!salaryDay) return 'Calendar month (1st)';
  if (salaryDay === 32) return 'Last day of month';
  return ordinal(salaryDay);
}
