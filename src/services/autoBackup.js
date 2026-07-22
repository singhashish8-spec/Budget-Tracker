import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { gatherData } from './backup';

// A snapshot of everything, rewritten automatically whenever the data changes,
// so a wiped database can be recovered without the user having remembered to
// back up. This exists because uninstalling/reinstalling the APK clears the
// app's private storage — including the SQLite file — and the user then lands
// back on onboarding with months of records gone.
//
// It is deliberately written to TWO places, because they fail in different ways:
//
//   Data (app files dir)  — included in Android's cloud backup to the user's
//                           Google account, so it comes back on a NEW PHONE.
//                           Erased by an uninstall unless Android restores it.
//   Documents (shared)    — survives uninstall/reinstall on the same phone, but
//                           never leaves the device.
//
// Only the JSON goes to the cloud, never the SQLite file: the JSON is a
// portable, mergeable snapshot that restores cleanly onto any install, whereas
// the raw database file is device-local plumbing (see the manifest's backup
// rules, which exclude the database domain).

const FILE = 'budget-tracker-autobackup.json';

const TARGETS = [
  // `cloud` = Android's backup agent picks this up (domain="file").
  { directory: Directory.Data, cloud: true, durable: false },
  // `durable` = outlives an uninstall on this device.
  { directory: Directory.Documents, cloud: false, durable: true },
  { directory: Directory.External, cloud: false, durable: false },
];

export async function writeAutoBackup() {
  const data = await gatherData();
  const json = JSON.stringify(data);
  const result = { ok: false, cloud: false, durable: false, at: null };

  for (const t of TARGETS) {
    try {
      await Filesystem.writeFile({
        path: FILE,
        data: json,
        directory: t.directory,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      result.ok = true;
      result.at = Date.now();
      if (t.cloud) result.cloud = true;
      if (t.durable) result.durable = true;
    } catch {
      // This location refused us (permissions / scoped storage). The others
      // are independent, so keep going rather than giving up entirely.
    }
  }
  return result;
}

function snapshotSize(parsed) {
  return (
    (parsed.transactions?.length ?? 0) +
    (parsed.budgets?.length ?? 0) +
    (parsed.reminders?.length ?? 0) +
    (parsed.goals?.length ?? 0)
  );
}

// Reads every location we might have written to and returns the NEWEST usable
// snapshot. Freshness matters: after Android restores a backup onto a new
// phone the cloud copy may be newer than a stale local one, or vice versa.
export async function readAutoBackup() {
  const found = [];
  for (const t of TARGETS) {
    try {
      const res = await Filesystem.readFile({ path: FILE, directory: t.directory, encoding: Encoding.UTF8 });
      const parsed = JSON.parse(typeof res.data === 'string' ? res.data : '');
      if (parsed?.app !== 'Budget Tracker') continue;
      const count = snapshotSize(parsed);
      if (count <= 0) continue;
      found.push({
        data: parsed,
        directory: t.directory,
        exportedAt: parsed.exportedAt || null,
        count,
        when: parsed.exportedAt ? Date.parse(parsed.exportedAt) || 0 : 0,
      });
    } catch {
      // Nothing here — keep looking.
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => b.when - a.when);
  return found[0];
}
