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

export function salaryDayLabel(salaryDay) {
  if (!salaryDay) return 'Calendar month (1st)';
  if (salaryDay === 32) return 'Last day of month';
  return ordinal(salaryDay);
}
