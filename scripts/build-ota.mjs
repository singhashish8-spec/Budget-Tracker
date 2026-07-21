// Assembles the GitHub Pages payload for the over-the-air updater.
// Assumes `dist/` has already been built (npm run build). Produces a `_site/`
// folder containing:
//   • budget-tracker-web-<version>.zip  (the web bundle, contents at zip root)
//   • latest.json                       ({ version, url }) — the "signpost" the app polls
//
// The CI workflow uploads `_site/` to GitHub Pages, so the app can finally find
// the update at https://<owner>.github.io/<repo>/latest.json.

import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { ZipArchive } from 'archiver';

const PAGES_BASE = 'https://singhashish8-spec.github.io/Budget-Tracker';

// Zip the CONTENTS of dist/ (index.html at the zip root) using forward slashes,
// which Android's unzipper needs. archiver always writes "/" paths.
function zipDir(srcDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

const version = readFileSync('web-version.txt', 'utf8').trim();
const zipName = `budget-tracker-web-${version}.zip`;

mkdirSync('_site', { recursive: true });
console.log(`▶ Zipping dist/ → _site/${zipName}`);
await zipDir('dist', `_site/${zipName}`);

const manifest = { version, url: `${PAGES_BASE}/${zipName}` };
writeFileSync('_site/latest.json', JSON.stringify(manifest, null, 2));

console.log(`✅ OTA payload ready in _site/ (version ${version})`);
console.log(`   latest.json → ${manifest.url}`);
