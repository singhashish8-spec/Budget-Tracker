import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Self-hosted over-the-air updates (no vendor cloud). The app always runs a
// bundle it already has (works offline), and in the background checks a small
// manifest on GitHub Pages for a newer web bundle. If found, it downloads the
// zip and queues it to apply on the NEXT launch — never interrupting the user,
// never blocking startup, and silently doing nothing when offline.
//
// Publish flow (see scripts/release-web.mjs): build → zip dist → upload the zip
// + a latest.json { version, url } to the repo's GitHub Pages.

const MANIFEST_URL = 'https://singhashish8-spec.github.io/Budget-Tracker/latest.json';

// Compares two dotted version strings numerically per segment, so "1.10.0"
// correctly reads as newer than "1.9.0" (a plain string/lexicographic
// compare would get that backwards). Returns 1 if a>b, -1 if a<b, 0 if
// equal or if either string can't be parsed as a dotted version.
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10));
  const pb = String(b).split('.').map((n) => parseInt(n, 10));
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return 0;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

// Whether `candidate` (a published manifest version) is actually newer than
// `current` (the version running now) — not just *different* from it. The
// check used to be plain equality ("is this different from what I'm
// running?"), which treats an older, rolled-back, or corrupted publish the
// same as a genuine update: it would silently re-download and apply an
// older bundle over a newer one already installed. 'builtin' (no OTA bundle
// downloaded yet — still running what's baked into the APK) has no version
// number to compare against, so anything published counts as worth having.
export function isNewerVersion(candidate, current) {
  if (current === 'builtin') return true;
  return compareVersions(candidate, current) > 0;
}

export async function initLiveUpdates() {
  if (!Capacitor.isNativePlatform()) return;
  // Tell the plugin THIS bundle loaded successfully, so it won't auto-roll-back
  // to the previous one. Must happen every launch.
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* not fatal */
  }
  // Fire-and-forget: an update check must never delay or break app startup.
  checkForUpdate().catch(() => {});
}

async function checkForUpdate() {
  let manifest;
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    return; // offline or host unreachable — keep running the current bundle
  }
  if (!manifest || typeof manifest.version !== 'string' || typeof manifest.url !== 'string') return;

  const current = await CapacitorUpdater.current().catch(() => null);
  const currentVersion = current?.bundle?.version || 'builtin';
  if (!isNewerVersion(manifest.version, currentVersion)) return; // not actually newer — nothing to do

  // Reuse an already-downloaded bundle of this version rather than re-fetching.
  const list = (await CapacitorUpdater.list().catch(() => null))?.bundles || [];
  let bundle = list.find((b) => b.version === manifest.version && b.status !== 'error');
  if (!bundle) {
    bundle = await CapacitorUpdater.download({ url: manifest.url, version: manifest.version });
  }
  // Apply on next background/relaunch — the recommended, non-disruptive path.
  await CapacitorUpdater.next({ id: bundle.id });
}

// ── Manual update (Settings → App updates) ──────────────────────────────────
// The same machinery as the silent auto-check, but driven by a button so the
// user can pull an update on demand and watch it download. Native only — the
// browser build has no bundle to swap.

export function updatesSupported() {
  return Capacitor.isNativePlatform();
}

// Fetch the published manifest { version, url } from GitHub Pages, or null if
// unreachable (offline / host down).
export async function fetchManifest() {
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const m = await res.json();
    if (!m || typeof m.version !== 'string' || typeof m.url !== 'string') return null;
    return m;
  } catch {
    return null;
  }
}

// The version of the bundle currently running.
export async function getCurrentVersion() {
  const current = await CapacitorUpdater.current().catch(() => null);
  return current?.bundle?.version || 'builtin';
}

// Download a bundle, reporting 0–100 progress via onProgress. Reuses an already
// downloaded copy of the same version instead of fetching it again. Returns the
// bundle so it can be applied.
export async function downloadUpdate(manifest, onProgress) {
  const list = (await CapacitorUpdater.list().catch(() => null))?.bundles || [];
  const existing = list.find((b) => b.version === manifest.version && b.status !== 'error');
  if (existing) {
    onProgress?.(100);
    return existing;
  }
  let handle;
  try {
    handle = await CapacitorUpdater.addListener('download', (s) => {
      if (s && typeof s.percent === 'number') onProgress?.(Math.max(0, Math.min(99, Math.round(s.percent))));
    });
  } catch {
    /* progress events unavailable — the bar will still jump to 100 on finish */
  }
  try {
    const bundle = await CapacitorUpdater.download({ url: manifest.url, version: manifest.version });
    onProgress?.(100);
    return bundle;
  } finally {
    try { await handle?.remove(); } catch { /* ignore */ }
  }
}

// Switch to the downloaded bundle and reload into it — the "restart" the user
// confirms. capgo swaps the active bundle and reloads the web view in place.
export async function applyUpdateAndReload(bundleId) {
  await CapacitorUpdater.set({ id: bundleId });
}
