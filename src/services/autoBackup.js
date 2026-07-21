import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { gatherData } from './backup';

// A snapshot of everything, rewritten automatically whenever the data changes,
// so a wiped database can be recovered without the user having remembered to
// back up. This exists because uninstalling/reinstalling the APK clears the
// app's private storage — including the SQLite file — and the user then lands
// back on onboarding with months of records gone.
//
// Android restricts where an app may write files that OUTLIVE an uninstall,
// and the rules differ by version, so we try the most durable location first
// and fall back. `directory` is reported back to the caller and surfaced in
// Settings: a snapshot sitting in app-private storage will NOT survive a
// reinstall, and the user deserves to know that rather than assume they're
// covered. This is on-device only — it does not protect against a lost phone,
// which is what the manual "Back up to Drive" is for.

const FILE = 'budget-tracker-autobackup.json';

// Most durable first. Documents is a shared folder that survives uninstall on
// most devices; External and Data are app-scoped and do not.
const TARGETS = [
  { directory: Directory.Documents, durable: true },
  { directory: Directory.External, durable: false },
  { directory: Directory.Data, durable: false },
];

export async function writeAutoBackup() {
  const data = await gatherData();
  const json = JSON.stringify(data);
  for (const t of TARGETS) {
    try {
      await Filesystem.writeFile({
        path: FILE,
        data: json,
        directory: t.directory,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return { ok: true, directory: t.directory, durable: t.durable, at: Date.now() };
    } catch {
      // Location refused (permissions / scoped storage) — try the next one.
    }
  }
  return { ok: false, directory: null, durable: false, at: null };
}

// Looks for a snapshot in every location we might have written one to.
// Returns null when there's nothing to recover.
export async function readAutoBackup() {
  for (const t of TARGETS) {
    try {
      const res = await Filesystem.readFile({ path: FILE, directory: t.directory, encoding: Encoding.UTF8 });
      const parsed = JSON.parse(typeof res.data === 'string' ? res.data : '');
      if (parsed && parsed.app === 'Budget Tracker') {
        const count =
          (parsed.transactions?.length ?? 0) +
          (parsed.budgets?.length ?? 0) +
          (parsed.reminders?.length ?? 0) +
          (parsed.goals?.length ?? 0);
        if (count > 0) return { data: parsed, directory: t.directory, exportedAt: parsed.exportedAt || null, count };
      }
    } catch {
      // Not here — keep looking.
    }
  }
  return null;
}
