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

import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { delimiter as PATH_DELIM, join as pathJoin } from 'node:path';

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

// --- verify the APK is actually signed before publishing it ---------------
// This is the file that installs as an UPDATE over what's already on
// people's phones — publishing an unsigned or wrong-certificate build here
// either fails to install for everyone, or (worse, if signed with a
// different but still-valid key) installs cleanly with no visible
// difference to the user. `apksigner` (from Android SDK build-tools) is the
// canonical way to check; it's installed by name in this project's CI
// workflow. If it can't be found at all (e.g. a manual run on a machine
// without the full SDK), this warns loudly rather than silently assuming
// the file is fine — it does not hard-block, since that would make manual
// publishing impossible on such a machine.
function findApksigner() {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const candidates = [];
  if (androidHome) {
    candidates.push(pathJoin(androidHome, 'build-tools'));
  }
  for (const dir of candidates) {
    try {
      const versions = readdirSync(dir).sort().reverse();
      for (const v of versions) {
        const exe = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
        const p = pathJoin(dir, v, exe);
        if (existsSync(p)) return p;
      }
    } catch { /* ANDROID_HOME/build-tools not laid out as expected — fall through to PATH */ }
  }
  const pathDirs = (process.env.PATH || '').split(PATH_DELIM);
  const exeName = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
  for (const dir of pathDirs) {
    const p = pathJoin(dir, exeName);
    if (existsSync(p)) return p;
  }
  return null;
}

const apksigner = findApksigner();
if (apksigner) {
  try {
    execFileSync(apksigner, ['verify', apkPath], { stdio: 'pipe' });
    console.log(`✔ Signature verified (${apksigner})`);
  } catch (e) {
    console.error(`\n❌ ${apkPath} failed signature verification — refusing to publish it.`);
    console.error('   This file would not install as a valid update. apksigner said:');
    console.error('   ' + (e.stderr?.toString().trim() || e.message));
    process.exit(1);
  }
} else {
  console.warn('\n⚠ Could not find `apksigner` (checked $ANDROID_HOME/build-tools and PATH) —');
  console.warn('  publishing WITHOUT verifying the APK is actually signed. If this upload');
  console.warn('  fails to install as an update on a phone that already has the app, this');
  console.warn('  is the first thing to check.\n');
}

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
    console.log('  (release exists — replacing the APK and its notes)');
    execFileSync('gh', ['release', 'upload', tag, uploadPath, '--repo', repoFlag, '--clobber'], {
      stdio: 'inherit',
    });
    // --clobber only replaces the binary asset — it leaves title/notes as
    // whatever they were the first time this tag was published. Since the
    // build number can change without the versionName tag changing (e.g. a
    // re-signed build, or a same-versionName rebuild), re-publishing without
    // this would leave the release page describing an older build than the
    // one actually being served underneath it.
    execFileSync('gh', ['release', 'edit', tag, '--repo', repoFlag, '--title', title, '--notes', notes], {
      stdio: 'inherit',
    });
  } else {
    execFileSync(
      'gh',
      ['release', 'create', tag, uploadPath, '--repo', repoFlag, '--title', title, '--notes', notes],
      { stdio: 'inherit' },
    );
  }
} catch {
  console.error('\n❌ gh failed to publish the release. Is it authenticated? Try:  gh auth status\n');
  process.exit(1);
}

const latestLink = `https://github.com/${OWNER}/${REPO}/releases/latest/download/${ASSET_NAME}`;
console.log(`\n✅ Published.`);
console.log('   Permanent phone link (always points at the newest APK):');
console.log(`     ${latestLink}`);
console.log('   Open that on the phone → download → tap to install (as an update).\n');
