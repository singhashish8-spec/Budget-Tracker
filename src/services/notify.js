import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { warrantyStatus } from '../state/selectors';

// Scheduled reminders for the two things that cost real money when missed: a
// warranty quietly running out, and a bill going unpaid.
//
// Everything is rescheduled from scratch on each app open. That sounds wasteful
// but it's the only reliable approach on Android: scheduled alarms are wiped by
// a reboot, and by some manufacturers' battery optimisation. Rebuilding the
// whole set whenever the app runs means the schedule self-heals instead of
// silently going dead — a reminder you can't trust is worse than none.

export function notificationsSupported() {
  return Capacitor.isNativePlatform();
}

export async function ensureNotificationPermission() {
  if (!notificationsSupported()) return false;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === 'granted';
  } catch {
    return false;
  }
}

export async function hasNotificationPermission() {
  if (!notificationsSupported()) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

// Notification ids are derived from the row id so a reschedule replaces the
// previous notification rather than stacking duplicates.
function idFor(prefix, key) {
  let h = 0;
  const s = `${prefix}:${key}`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  // Android needs a positive 32-bit int.
  return Math.abs(h % 2000000000) + 1;
}

const DAY = 86400000;

// Register the "Mark paid" button once, so a bill can be settled straight from
// the notification shade without opening the app.
export async function registerActions() {
  if (!notificationsSupported()) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'BILL',
          actions: [
            { id: 'mark_paid', title: 'Mark paid' },
            { id: 'open', title: 'Open' },
          ],
        },
        { id: 'WARRANTY', actions: [{ id: 'open', title: 'View' }] },
      ],
    });
  } catch {
    /* action types are a nicety — a plain notification still works */
  }
}

function buildWarrantyNotifications(warranties, now) {
  const out = [];
  for (const w of warranties || []) {
    if (!w.warranty_months) continue;
    const { expireDate } = warrantyStatus(w.purchase_at, w.warranty_months, w.extended_months, now);
    // Warn early enough to actually do something — buy an extension, or get a
    // last free service in — and again when it's nearly gone.
    for (const daysBefore of [60, 15]) {
      const at = new Date(expireDate.getTime() - daysBefore * DAY);
      if (at.getTime() <= now.getTime()) continue;
      out.push({
        id: idFor(`war${daysBefore}`, w.id),
        title: `${w.product} warranty ends in ${daysBefore} days`,
        body: `Cover runs out ${expireDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Worth checking it over while it's still covered.`,
        schedule: { at },
        actionTypeId: 'WARRANTY',
        extra: { kind: 'warranty', id: w.id },
      });
    }
  }
  return out;
}

function buildBillNotifications(reminders, now) {
  const out = [];
  for (const r of reminders || []) {
    const day = Math.min(28, Math.max(1, r.due_day || 1));
    // Next occurrence of the due day: this month if it hasn't passed, else next.
    let at = new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0);
    if (at.getTime() <= now.getTime()) at = new Date(now.getFullYear(), now.getMonth() + 1, day, 9, 0, 0);
    out.push({
      id: idFor('bill', r.id),
      title: `${r.label} is due today`,
      body: `₹${Number(r.amount || 0).toLocaleString('en-IN')} — mark it paid once it's done.`,
      schedule: { at, every: 'month' },
      actionTypeId: 'BILL',
      extra: { kind: 'bill', id: r.id },
    });
  }
  return out;
}

// Wipe and rebuild the whole schedule. Called on app open and whenever the
// underlying warranties or bills change.
export async function syncSchedule({ warranties, reminders }, now = new Date()) {
  if (!notificationsSupported()) return { scheduled: 0 };
  if (!(await hasNotificationPermission())) return { scheduled: 0, denied: true };

  try {
    const pending = await LocalNotifications.getPending();
    if (pending?.notifications?.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    /* nothing pending, or the list is unavailable — carry on and schedule */
  }

  const list = [...buildWarrantyNotifications(warranties, now), ...buildBillNotifications(reminders, now)]
    // Android caps how many alarms an app may hold; keep the soonest.
    .sort((a, b) => a.schedule.at - b.schedule.at)
    .slice(0, 48);

  if (!list.length) return { scheduled: 0 };
  try {
    await LocalNotifications.schedule({ notifications: list });
    return { scheduled: list.length };
  } catch {
    return { scheduled: 0, failed: true };
  }
}

export async function cancelAll() {
  if (!notificationsSupported()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending?.notifications?.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    /* nothing to cancel */
  }
}
