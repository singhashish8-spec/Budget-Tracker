import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as repo from '../db/repo';

// "Easy Google Drive backup" without OAuth: we serialize all app data to a
// JSON file and open the native share sheet, where "Save to Drive" is one tap.
// This is a manual backup (user taps "Back up") — genuinely automatic
// background sync would require a Google OAuth client + the Drive API, which
// needs a Google Cloud project set up under the user's own account. See
// README "Backup".

async function gatherData() {
  const [categories, transactions, budgets, reminders, goals, netWorthItems] = await Promise.all([
    repo.listCategories(),
    repo.listTransactions(),
    repo.listBudgets(),
    repo.listReminders(),
    repo.listGoals(),
    repo.listNetWorthItems(),
  ]);
  return {
    app: 'Budget Tracker',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    categories,
    transactions,
    budgets,
    reminders,
    goals,
    netWorthItems,
  };
}

export async function backupToDrive() {
  const data = await gatherData();
  const json = JSON.stringify(data, null, 2);
  const filename = `budget-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const result = await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Cache,
    encoding: 'utf8',
  });
  await Share.share({
    title: 'Budget Tracker backup',
    text: 'Save this to Google Drive to back up your data',
    url: result.uri,
  });
}

// Restore from a backup JSON File (picked via a file input). Validates the
// file looks like our backup, then merges it into the local database.
// Returns the per-table counts so the UI can confirm what came back.
export async function restoreFromFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a valid backup');
  }
  if (!data || data.app !== 'Budget Tracker' || !Array.isArray(data.transactions)) {
    throw new Error('That doesn’t look like a Budget Tracker backup');
  }
  return repo.importBackup(data);
}
