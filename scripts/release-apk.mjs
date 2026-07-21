// Publishes a built APK to GitHub Releases so it has a phone-friendly download link.
// Run (after building the APK):  npm run release:apk  [path-to.apk]
//
// What it does:
//   • reads the app version from android/app/build.gradle
//   • uploads the APK to a GitHub Release, ALWAYS named "BudgetTracker.apk"
//   • because the name never changes, this permanent link always points at the
//     newest APK — bookmark it on the phone once:
//        https://github.com/<owner>/<repo>/releases/latest/download/BudgetTracker.apk
//
// Requirements: the `gh` CLI, installed and authenticated (repo scope).
//   On the Windows build PC gh isn't on PATH — prefix the command with:
//     export PATH="$PATH:/c/Program Files/GitHub CLI"
//
// The APK must be signed with the release keystore (same cert as the installed
// app) so it installs AS AN UPDATE. This script never builds or signs — it only
// uploads whatever APK you point it at.

import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';

const OWNER = 'singhashish8-spec';
const REPO = 'Budget-Tracker';
const ASSET_NAME = 'BudgetTracker.apk'; // fixed name → stable "latest" download link

// --- locate the APK -------------------------------------------------------
const CANDIDATES = [
  process.argv[2], // explicit path wins
  'BudgetTracker.apk',
  'android/app/build/outputs/apk/release/app-release.apk',
].filter(Boolean);

const apkPath = CANDIDATES.find((p) => existsSync(p));
if (!apkPath) {
  console.error('\n❌ No APK found. Build it first, then run this again.');
  console.error('   Looked in:');
  CANDIDATES.forEach((p) => console.error(`     • ${p}`));
  console.error('   Or pass the path directly:  npm run release:apk C:\\path\\to\\BudgetTracker.apk\n');
  process.exit(1);
}

// --- read version from the Android project --------------------------------
const gradle = readFileSync('android/app/build.gradle', 'utf8');
const versionName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1] || '0.0';
const versionCode = (gradle.match(/versionCode\s+(\d+)/) || [])[1] || '0';
const webVersion = existsSync('web-version.txt')
  ? readFileSync('web-version.txt', 'utf8').trim()
  : 'unknown';

const tag = `v${versionName}`;
const title = `Budget Tracker v${versionName} (build ${versionCode})`;
const notes = [
  `App version **${versionName}** (build ${versionCode}).`,
  `Bundled web layer: **${webVersion}**.`,
  '',
  '**Install:** download on the phone and tap it. It installs **as an update over',
  'the existing app** — do **NOT** uninstall first (uninstalling erases your data).',
].join('\n');

// --- make sure the uploaded file has the fixed name -----------------------
mkdirSync('release', { recursive: true });
const uploadPath = `release/${ASSET_NAME}`;
copyFileSync(apkPath, uploadPath);

// --- check gh is available ------------------------------------------------
try {
  execFileSync('gh', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('\n❌ The `gh` CLI was not found on PATH.');
  console.error('   On the Windows build PC, run this first, then retry:');
  console.error('     export PATH="$PATH:/c/Program Files/GitHub CLI"\n');
  process.exit(1);
}

const repoFlag = `${OWNER}/${REPO}`;

console.log(`\n▶ Publishing ${apkPath}`);
console.log(`  → release ${tag} on ${repoFlag}, asset "${ASSET_NAME}"`);

// Does the release already exist? If so just replace the asset; else create it.
let exists = true;
try {
  execFileSync('gh', ['release', 'view', tag, '--repo', repoFlag], { stdio: 'ignore' });
} catch {
  exists = false;
}

try {
  if (exists) {
    console.log('  (release exists — replacing the APK on it)');
    execFileSync('gh', ['release', 'upload', tag, uploadPath, '--repo', repoFlag, '--clobber'], {
      stdio: 'inherit',
    });
  } else {
    execFileSync(
      'gh',
      ['release', 'create', tag, uploadPath, '--repo', repoFlag, '--title', title, '--notes', notes],
      { stdio: 'inherit' },
    );
  }
} catch (e) {
  console.error('\n❌ gh failed to publish the release. Is it authenticated? Try:  gh auth status\n');
  process.exit(1);
}

const latestLink = `https://github.com/${OWNER}/${REPO}/releases/latest/download/${ASSET_NAME}`;
console.log(`\n✅ Published.`);
console.log('   Permanent phone link (always points at the newest APK):');
console.log(`     ${latestLink}`);
console.log('   Open that on the phone → download → tap to install (as an update).\n');
