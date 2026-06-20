// Rewrites packaging/homebrew/mdsite.rb for a release: sets `version`, the
// download-URL version segments, and each platform `sha256` from the built
// release tarballs. The release CI runs this, then commits the formula to the
// tap repo (THANSHEER/homebrew-tap).
//
//   node scripts/update-formula.mjs [releaseDir]
//
// releaseDir defaults to build/release and should contain the four
// mdsite-<os>-<arch>.tar.gz assets. Missing assets are left unchanged.
// Version comes from package.json, or $MDSITE_RELEASE_VERSION.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.env.MDSITE_RELEASE_VERSION || pkg.version;
const relDir = process.argv[2] || path.join(root, 'build', 'release');
const formulaPath = path.join(root, 'packaging', 'homebrew', 'mdsite.rb');

const assets = [
  'mdsite-darwin-arm64.tar.gz',
  'mdsite-darwin-x64.tar.gz',
  'mdsite-linux-arm64.tar.gz',
  'mdsite-linux-x64.tar.gz',
];

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

let formula = readFileSync(formulaPath, 'utf8');
formula = formula.replace(/version "[^"]*"/, `version "${version}"`);
formula = formula.replace(/releases\/download\/v[^/]+\//g, `releases/download/v${version}/`);

const lines = formula.split('\n');
for (let i = 0; i < lines.length; i++) {
  const asset = assets.find((a) => lines[i].includes(a));
  if (!asset) continue;
  const file = path.join(relDir, asset);
  if (!existsSync(file)) {
    console.log(`  ${asset}: missing in ${path.relative(root, relDir)} — left unchanged`);
    continue;
  }
  const hash = sha256(file);
  for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
    if (/sha256 "/.test(lines[j])) {
      lines[j] = lines[j].replace(/sha256 "[^"]*"/, `sha256 "${hash}"`);
      break;
    }
  }
  console.log(`  ${asset}: ${hash}`);
}

writeFileSync(formulaPath, lines.join('\n'));
console.log(`update-formula: version ${version} -> ${path.relative(root, formulaPath)}`);
