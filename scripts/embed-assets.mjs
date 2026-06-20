// Generates sea-config.json + the KaTeX font manifest for the standalone
// (Node SEA) build. Invoked by scripts/build-sea.mjs after `npm run build` and
// the --binary bundle exist.
//
// The asset KEYS written here must match the constants in src/assets.ts
// (SEA_CLIENT_KEY, SEA_KATEX_CSS_KEY, SEA_KATEX_FONTS_MANIFEST_KEY,
// seaKatexFontKey) — that's the read side, this is the write side.

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const buildDir = path.join(root, 'build');

const katexDist = path.join(path.dirname(require.resolve('katex/package.json')), 'dist');
const fontsDir = path.join(katexDist, 'fonts');
const clientJs = path.join(root, 'dist', 'client', 'mdsite.client.js');
const mermaidJs = path.join(root, 'dist', 'client', 'mdsite.mermaid.js');
const bundle = path.join(buildDir, 'mdsite.bundle.cjs');

for (const [label, p] of [
  ['client runtime', clientJs],
  ['mermaid runtime', mermaidJs],
  ['binary bundle', bundle],
]) {
  if (!existsSync(p)) {
    console.error(`embed-assets: missing ${label} at ${p}. Run the build first.`);
    process.exit(1);
  }
}

await fs.mkdir(buildDir, { recursive: true });

// 1. KaTeX font manifest — the list the binary re-emits at build time.
const fontFiles = (await fs.readdir(fontsDir)).filter((f) => !f.startsWith('.'));
const manifestPath = path.join(buildDir, 'katex-fonts.json');
await fs.writeFile(manifestPath, JSON.stringify(fontFiles));

// 2. Asset map: SEA key -> absolute source path (absolute = cwd-independent).
const assets = {
  'mdsite.client.js': clientJs,
  'mdsite.mermaid.js': mermaidJs,
  'katex.min.css': path.join(katexDist, 'katex.min.css'),
  'katex/fonts.json': manifestPath,
};
for (const name of fontFiles) {
  assets[`katex/fonts/${name}`] = path.join(fontsDir, name);
}

// 3. SEA config consumed by `node --experimental-sea-config`.
const seaConfig = {
  main: bundle,
  output: path.join(buildDir, 'mdsite.blob'),
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
  assets,
};
const seaConfigPath = path.join(root, 'sea-config.json');
await fs.writeFile(seaConfigPath, `${JSON.stringify(seaConfig, null, 2)}\n`);

console.log(
  `embed-assets: client + mermaid + katex.min.css + ${fontFiles.length} fonts -> sea-config.json`,
);
