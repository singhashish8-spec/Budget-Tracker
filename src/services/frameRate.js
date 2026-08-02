// Frame-rate detection and capping for the app's JavaScript-driven animation.
//
// ── What this can and cannot do ───────────────────────────────────────────
// It CANNOT raise anything. requestAnimationFrame fires at the display's
// refresh rate; there is no web API to make a panel run faster, and a phone
// cannot render frames its screen will never show. Android exposes a native
// `preferredRefreshRate` on the Activity, but that only picks between modes the
// panel already supports, it lives in Java, and it would need a new APK — none
// of which is reachable from a web bundle.
//
// What it CAN do is cap: skip frames so animation runs at or below the display
// rate. On a 120Hz phone, holding the count-up and the tilt highlight to 60 is
// half the JavaScript and half the style invalidation for motion most people
// cannot tell apart. That is a real battery lever, which is why it exists.
//
// It only governs animation this app drives from JS — the count-up figure and
// the tilt highlight. CSS transitions and keyframes (screen changes, bar fills,
// the aurora, press feedback) are run by the compositor at the display's rate
// and cannot be throttled from script. Anything claiming otherwise in the UI
// would be lying, so the Settings copy says exactly this.

// Offered rates. Everything above the detected panel rate is shown but marked
// unavailable rather than hidden, because "why can't I pick 240?" deserves an
// answer in the UI instead of a silently short list.
export const FRAME_RATES = [
  { key: 'auto', label: 'Auto', hz: null },
  { key: '240', label: '240', hz: 240 },
  { key: '180', label: '180', hz: 180 },
  { key: '120', label: '120', hz: 120 },
  { key: '90', label: '90', hz: 90 },
  { key: '60', label: '60', hz: 60 },
  { key: '30', label: '30', hz: 30 },
];

export const FRAME_RATE_KEYS = FRAME_RATES.map((f) => f.key);

// The rates a display is actually likely to run at. A measured interval is
// snapped to the nearest of these so a noisy sample doesn't report "58 Hz".
const COMMON_HZ = [30, 48, 50, 60, 72, 90, 120, 144, 165, 240];

let detected = null;
let detecting = null;

// Measure the real refresh rate by timing consecutive animation frames. Uses
// the median rather than the mean: a single long frame (a GC pause, a slow
// paint elsewhere) would drag an average down and under-report the panel.
export function detectRefreshRate() {
  if (detected) return Promise.resolve(detected);
  if (detecting) return detecting;
  if (typeof window === 'undefined' || !window.requestAnimationFrame) return Promise.resolve(60);

  detecting = new Promise((resolve) => {
    const gaps = [];
    let last = 0;
    let frames = 0;
    const SAMPLES = 24;

    const step = (now) => {
      if (last) gaps.push(now - last);
      last = now;
      frames += 1;
      if (frames < SAMPLES) {
        requestAnimationFrame(step);
        return;
      }
      let hz = 60;
      if (gaps.length) {
        const sorted = [...gaps].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (median > 0) hz = 1000 / median;
      }
      // Snap to the nearest plausible panel rate.
      detected = COMMON_HZ.reduce((best, c) => (Math.abs(c - hz) < Math.abs(best - hz) ? c : best), 60);
      resolve(detected);
    };
    requestAnimationFrame(step);
  });
  return detecting;
}

// Last detected rate without measuring again. Null until detectRefreshRate()
// has resolved once.
export function knownRefreshRate() {
  return detected;
}

// Is this option achievable on this display? Anything above the panel rate is
// not — the frames would never be shown.
export function isRateAvailable(key, displayHz = detected) {
  const opt = FRAME_RATES.find((f) => f.key === key);
  if (!opt || opt.hz == null) return true; // 'auto' always works
  if (!displayHz) return true; // not measured yet — don't grey things out on a guess
  return opt.hz <= displayHz;
}

// A gate for an existing rAF loop. Returns a function that answers "should this
// frame do work?", so a caller keeps its own loop and simply skips frames:
//
//   const gate = makeFrameGate(cap);
//   const step = (now) => { if (gate(now)) { ...work... } raf(step); };
//
// 'auto' and any cap at or above the panel rate return a gate that always
// passes, so the normal path costs one comparison and nothing else.
export function makeFrameGate(key) {
  const opt = FRAME_RATES.find((f) => f.key === key);
  const hz = opt?.hz ?? null;
  if (!hz) return () => true;
  // A frame is due slightly before the exact interval elapses: waiting for the
  // full period means a 60 Hz cap on a 60 Hz display drops every other frame to
  // rounding, halving the rate the user asked for.
  const interval = 1000 / hz - 1;
  let previous = -Infinity;
  return (now) => {
    if (now - previous >= interval) {
      previous = now;
      return true;
    }
    return false;
  };
}
