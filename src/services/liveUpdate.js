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
  if (manifest.version === currentVersion) return; // already up to date

  // Reuse an already-downloaded bundle of this version rather than re-fetching.
  const list = (await CapacitorUpdater.list().catch(() => null))?.bundles || [];
  let bundle = list.find((b) => b.version === manifest.version && b.status !== 'error');
  if (!bundle) {
    bundle = await CapacitorUpdater.download({ url: manifest.url, version: manifest.version });
  }
  // Apply on next background/relaunch — the recommended, non-disruptive path.
  await CapacitorUpdater.next({ id: bundle.id });
}
