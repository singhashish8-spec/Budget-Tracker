// Packages a new web bundle for over-the-air update.
// Run: npm run release:web
// Produces release/budget-tracker-web-<version>.zip and release/latest.json.
// You then upload BOTH files to the GitHub Pages repo (main branch root).

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { ZipArchive } from 'archiver';

// Zip the CONTENTS of `srcDir` (so index.html is at the zip root) using forward
// slashes — Windows' Compress-Archive writes backslash paths that Android's
// unzipper mishandles, breaking the bundle. archiver always uses "/".
function zipDir(srcDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, false); // false = contents at root, not nested
    archive.finalize();
  });
}

const PAGES_BASE = 'https://singhashish8-spec.github.io/Budget-Tracker';
const VER_FILE = 'web-version.txt';

// Bump the patch version (monotonic — the app only updates when it changes).
let version = existsSync(VER_FILE) ? readFileSync(VER_FILE, 'utf8').trim() : '1.0.0';
const p = version.split('.').map((n) => parseInt(n, 10) || 0);
p[2] = (p[2] || 0) + 1;
version = `${p[0]}.${p[1]}.${p[2]}`;
writeFileSync(VER_FILE, version + '\n');

console.log(`\n▶ Building web bundle v${version}…`);
execSync('npm run build', { stdio: 'inherit' });

mkdirSync('release', { recursive: true });
const zipName = `budget-tracker-web-${version}.zip`;

// Zip the CONTENTS of dist/ so index.html sits at the zip root (what capgo expects).
console.log(`▶ Zipping → release/${zipName}`);
await zipDir('dist', `release/${zipName}`);

const manifest = { version, url: `${PAGES_BASE}/${zipName}` };
writeFileSync('release/latest.json', JSON.stringify(manifest, null, 2));

console.log(`\n✅ Release v${version} ready in ./release/`);
console.log('   Upload BOTH of these to your GitHub repo (main branch, root folder):');
console.log(`     • ${zipName}`);
console.log('     • latest.json');
console.log('   The app will pick it up on the next launch.\n');
