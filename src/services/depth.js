import { Capacitor } from '@capacitor/core';
import { makeFrameGate } from './frameRate';

// The engine behind the three "depth" skins (Frosted, Liquid Glass, Spatial).
//
// Those skins want two things plain CSS can't provide on its own:
//
//   1. A device-tilt signal, so specular highlights slide across glass and
//      spatial layers parallax as the phone moves. This is what separates a
//      real glass impression from a static gradient pretending to be one —
//      on iOS the highlight tracks the device, and its absence is the main
//      reason a web "glassmorphism" attempt reads as a flat picture of glass.
//
//   2. An honest answer to "can this phone actually afford it?". Stacked
//      backdrop-filters are the single most expensive thing a WebView can be
//      asked to composite, and this app's own history has the scar: sixty
//      day-group cards each mounting their own blur layer turned the
//      Transactions screen into a slideshow. So effects are tiered, and the
//      top tier is only ever handed to a device that measurably keeps up.
//
// Everything here is best-effort and self-disabling. No sensor, no permission,
// a slow phone, the app in the background, or motion turned off in Settings —
// each independently drops us to a cheaper tier rather than breaking anything.

// 'max'      — everything: card blur, refraction, tilt parallax, animated aurora
// 'balanced' — blur on chrome/sheets only, static highlights, no sensors
// 'off'      — flat translucency, zero blur, zero motion
export const DEPTHS = [
  { key: 'max', label: 'Max', hint: 'Every effect — best on a recent phone' },
  { key: 'balanced', label: 'Balanced', hint: 'Blur on menus and sheets only' },
  { key: 'off', label: 'Off', hint: 'Flat and fastest' },
];

export const DEPTH_KEYS = DEPTHS.map((d) => d.key);

// How far the phone has to tilt to push a highlight to its extreme. Deliberately
// small: a highlight that only moves when you wave the phone around reads as
// broken, and one tied to the full ±90° range barely moves in normal handling.
const TILT_RANGE_DEG = 22;
// Exponential smoothing on the raw sensor. Gyroscope output is noisy enough
// that feeding it straight to a highlight makes the glass visibly shimmer while
// the phone sits still on a table.
const TILT_SMOOTHING = 0.12;

let tiltHandle = null;
let rafHandle = 0;
let target = { x: 0, y: 0 };
let current = { x: 0, y: 0 };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Does this device look like it can afford the top tier? Deliberately
// conservative — a wrong "yes" costs the user a stuttering app, a wrong "no"
// costs them an effect they can still switch on by hand in Settings.
export function detectDepthCapability() {
  if (typeof navigator === 'undefined') return 'balanced';
  // deviceMemory is Chromium-only and reports in GiB, rounded down to a power
  // of two. Anything at or under 4 GB is a budget Android phone in 2026 terms.
  const mem = navigator.deviceMemory;
  if (typeof mem === 'number' && mem <= 4) return 'balanced';
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores <= 4) return 'balanced';
  // No signal either way (older WebView): assume the cheaper tier. The user can
  // always raise it, and the failure mode of guessing high is much worse.
  if (typeof mem !== 'number' && typeof cores !== 'number') return 'balanced';
  return 'max';
}

// Is motion allowed at all right now? Mirrors CountUp's check so the tilt
// engine can never be the one thing in the app still moving after the user
// asked for stillness.
function motionAllowed() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  const level = document.documentElement.getAttribute('data-motion');
  if (level === 'off' || level === 'reduced') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function writeTilt(x, y) {
  const root = document.documentElement;
  root.style.setProperty('--tilt-x', x.toFixed(3));
  root.style.setProperty('--tilt-y', y.toFixed(3));
}

// One rAF loop eases the smoothed value toward the latest reading. Running the
// write inside rAF (rather than straight from the sensor callback, which can
// fire far faster than the display refreshes) keeps this to at most one style
// write per frame.
// The frame-rate cap, if the user set one. Rebuilt whenever the setting
// changes so the running loop picks it up without restarting.
let frameGate = () => true;
export function setTiltFrameRate(key) {
  frameGate = makeFrameGate(key);
}

function tick(now) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    rafHandle = 0;
    return;
  }
  // Skipping a frame here skips a style write and everything downstream of it.
  // The easing below is time-independent enough that a capped loop simply takes
  // larger steps — the highlight still lands in the same place.
  if (frameGate(now)) {
    current.x += dx * TILT_SMOOTHING;
    current.y += dy * TILT_SMOOTHING;
    writeTilt(current.x, current.y);
  }
  rafHandle = requestAnimationFrame(tick);
}

function onOrientation(e) {
  // gamma = left/right tilt (-90..90), beta = front/back (-180..180).
  const gamma = typeof e.gamma === 'number' ? e.gamma : 0;
  const beta = typeof e.beta === 'number' ? e.beta : 0;
  // beta sits near 45-70° when a phone is held at a natural reading angle, so
  // it's re-centred on 45 rather than 0 — otherwise the highlight is pinned to
  // one extreme the entire time the phone is being used normally.
  target = {
    x: clamp(gamma / TILT_RANGE_DEG, -1, 1),
    y: clamp((beta - 45) / TILT_RANGE_DEG, -1, 1),
  };
  if (!rafHandle) rafHandle = requestAnimationFrame(tick);
}

// Start listening to device tilt. Safe to call repeatedly — it no-ops if
// already running, unsupported, not native, or motion is switched off.
export function startTilt() {
  if (tiltHandle) return;
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  if (!motionAllowed()) return;
  if (typeof window.DeviceOrientationEvent === 'undefined') return;
  try {
    tiltHandle = onOrientation;
    window.addEventListener('deviceorientation', tiltHandle, { passive: true });
  } catch {
    tiltHandle = null; // sensor blocked — highlights simply stay centred
  }
}

export function stopTilt() {
  if (tiltHandle) {
    try { window.removeEventListener('deviceorientation', tiltHandle); } catch { /* ignore */ }
    tiltHandle = null;
  }
  if (rafHandle) {
    cancelAnimationFrame(rafHandle);
    rafHandle = 0;
  }
  // Ease back to neutral rather than snapping, so switching skins or
  // backgrounding the app doesn't jolt every highlight to centre.
  target = { x: 0, y: 0 };
  current = { x: 0, y: 0 };
  if (typeof document !== 'undefined') writeTilt(0, 0);
}

// Skins that actually consume the depth engine. Anything else leaves the
// sensors off entirely — Paper has no use for a gyroscope.
const DEPTH_SURFACES = new Set(['glass', 'liquid', 'spatial']);

export function surfaceUsesDepth(surface) {
  return DEPTH_SURFACES.has(surface);
}

// Called whenever the skin, the depth level or the motion preference changes.
// Tilt is a 'max'-only luxury: it wakes a sensor and writes a style every
// frame the phone is moving, which is not something to run on a budget device
// or on someone who asked for reduced motion.
export function syncTilt({ surface, depth, motion }) {
  const wants =
    depth === 'max' &&
    surfaceUsesDepth(surface) &&
    motion !== 'off' &&
    motion !== 'reduced';
  if (wants) startTilt();
  else stopTilt();
}
