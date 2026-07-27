import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Tiered haptics.
//
// The temptation is to buzz on every tap. iOS deliberately doesn't: it fires on
// state CHANGES — a toggle flipping, a picker landing, something saved — and
// stays silent for scrolling and plain navigation. Firing on everything is what
// makes an app feel buzzy and cheap, and it costs battery. So there are four
// levels and each has a job:
//
//   tap()      a primary action was taken        (Save, Add, Mark paid)
//   select()   a choice changed                  (chips, segments, month steps)
//   success()  something committed               (saved, backed up)
//   warn()     something wants your attention    (cooling-off, over budget)
//   error()    something destructive or wrong    (delete, reset, failure)
//
// Strength follows the user's setting: 'full' | 'light' | 'off'. On the web
// there is no Haptics implementation, so calls no-op rather than throwing.

let level = 'full';
export function setHapticLevel(next) {
  level = next || 'full';
}
export function getHapticLevel() {
  return level;
}

const supported = () => level !== 'off' && Capacitor.isNativePlatform();

// Every call is fire-and-forget: a haptic failing must never interrupt the
// action the user actually asked for.
function safe(fn) {
  if (!supported()) return;
  try {
    const r = fn();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch {
    /* haptics are decoration — never let them break a flow */
  }
}

export function tap() {
  safe(() => Haptics.impact({ style: level === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }));
}

// A light tick for changing a choice.
//
// This deliberately does NOT use Haptics.selectionChanged(). On Android that
// call is a no-op unless selectionStart() ran first — the plugin guards it
// behind an internal flag — so every chip, segment and stepper tick fired
// nothing at all. impact(Light) is a real vibration and needs no setup, which
// makes it both correct and consistent with the rest of the scale.
export function select() {
  safe(() => Haptics.impact({ style: ImpactStyle.Light }));
}

export function success() {
  if (level === 'light') return tap();
  safe(() => Haptics.notification({ type: NotificationType.Success }));
}

export function warn() {
  if (level === 'light') return tap();
  safe(() => Haptics.notification({ type: NotificationType.Warning }));
}

export function error() {
  if (level === 'light') return tap();
  safe(() => Haptics.notification({ type: NotificationType.Error }));
}

export const HAPTIC_LEVELS = [
  { key: 'full', label: 'Full' },
  { key: 'light', label: 'Light' },
  { key: 'off', label: 'Off' },
];
