import esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const watch = process.argv.includes('--watch');
// `--binary` builds the self-contained bundle that feeds the standalone
// (Node SEA) executable instead of the normal npm dist outputs.
const binary = process.argv.includes('--binary');

// Shared options for the Node-targeted builds. Dependencies stay external
// (resolved from node_modules at runtime) so we ship small JS and don't re-bundle
// big deps like shiki/katex. ESM output to match "type": "module".
const nodeCommon = {
  platform: 'node',
  format: 'esm',
  target: 'node18',
  bundle: true,
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
  // Bundle the default theme's CSS into the JS as a string.
  loader: { '.css': 'text' },
  // Stamped into every build (CLI, library, binary) so a generated site —
  // and `mdgarden --version` — always know which mdgarden version made them.
  define: { MDGARDEN_VERSION: JSON.stringify(pkg.version) },
};

// The CLI binary — gets a shebang so `mdgarden` is directly executable.
const cliBuild = {
  ...nodeCommon,
  entryPoints: ['src/cli/cli.ts'],
  outfile: 'dist/cli.js',
  banner: { js: '#!/usr/bin/env node' },
};

// The programmatic entry (imported as a module — no shebang, or Node chokes).
const libBuild = {
  ...nodeCommon,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
};

// The browser build: a single small client bundle (dark-mode, search, graph, nav)
// that the emitter copies into the generated site. Everything is bundled here.
const clientBuild = {
  // 'mdgarden.mermaid' is a separate, self-contained bundle the main client
  // injects on demand (it carries the heavy mermaid library).
  entryPoints: {
    'mdgarden.client': 'src/client/index.ts',
    'mdgarden.mermaid': 'src/client/mermaid.ts',
  },
  outdir: 'dist/client',
  platform: 'browser',
  format: 'iife',
  target: ['es2019'],
  bundle: true,
  minify: true,
  sourcemap: false,
  logLevel: 'info',
};

// The standalone-binary bundle: one self-contained CommonJS file with every
// dependency inlined (no node_modules at runtime). CJS avoids the rough edges
// of ESM inside a Node SEA. Output lives in build/ (gitignored, never published
// to npm). The browser client + KaTeX assets are NOT here — they're embedded
// into the binary as SEA assets and read back via src/assets.ts.
const binaryBuild = {
  ...nodeCommon,
  packages: 'bundle',
  format: 'cjs',
  target: 'node20',
  entryPoints: ['src/cli/cli.ts'],
  outfile: 'build/mdgarden.bundle.cjs',
  sourcemap: false,
};

const builds = binary ? [binaryBuild] : [cliBuild, libBuild, clientBuild];

async function run() {
  if (watch) {
    const ctxs = await Promise.all(builds.map((b) => esbuild.context(b)));
    await Promise.all(ctxs.map((c) => c.watch()));
    console.log('mdgarden: watching for changes...');
    return;
  }
  await Promise.all(builds.map((b) => esbuild.build(b)));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
