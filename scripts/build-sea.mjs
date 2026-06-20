// Builds a standalone `mdsite` executable for the CURRENT OS/arch using Node's
// Single Executable Application (SEA) support. No Node is required to RUN the
// result — everything (engine, deps, client runtime, KaTeX CSS + fonts) is
// embedded. SEA can't cross-compile, so CI runs this once per OS in a matrix.
//
// IMPORTANT: SEA must be built from an *official* (statically-linked) Node binary
// that carries the fuse sentinel. Homebrew's `node` is a tiny launcher over a
// shared libnode and will NOT work. In CI, actions/setup-node provides an
// official binary. Locally, download one from https://nodejs.org/dist and run:
//   MDSITE_SEA_NODE=/path/to/node-vXX/bin/node npm run build:binary
//
// Pipeline:
//   1. npm run build            -> dist/ (incl. the browser client runtime)
//   2. esbuild --binary         -> build/mdsite.bundle.cjs (all deps inlined)
//   3. embed-assets             -> sea-config.json + build/katex-fonts.json
//   4. node --experimental-sea-config -> build/mdsite.blob
//   5. copy the base node binary, inject the blob with postject, (re)sign on macOS

import { execFileSync } from 'node:child_process';
import { promises as fs, copyFileSync, chmodSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const buildDir = path.join(root, 'build');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const baseNode = process.env.MDSITE_SEA_NODE || process.execPath;

function run(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root });
}

// SEA-capable Node binaries embed the fuse sentinel; launchers/shared builds don't.
function supportsSea(file) {
  try {
    return readFileSync(file).includes(FUSE);
  } catch {
    return false;
  }
}

if (!supportsSea(baseNode)) {
  const kb = (() => {
    try {
      return Math.round(statSync(baseNode).size / 1024);
    } catch {
      return '?';
    }
  })();
  console.error(
    `\n✗ Base Node binary does not support SEA (no fuse sentinel):\n` +
      `    ${baseNode}  (${kb} KB)\n\n` +
      `  This is usually a Homebrew/shared build (a small launcher over libnode).\n` +
      `  Download an official build from https://nodejs.org/dist and point to it:\n` +
      `    MDSITE_SEA_NODE=/path/to/node-vXX-${process.platform}-${process.arch}/bin/node \\\n` +
      `      npm run build:binary\n` +
      `  (In CI, actions/setup-node already installs an official, SEA-capable Node.)\n`,
  );
  process.exit(1);
}

const npm = isWin ? 'npm.cmd' : 'npm';
const npx = isWin ? 'npx.cmd' : 'npx';

// 1-3. Build everything the SEA blob needs.
run(npm, ['run', 'build']);
run('node', ['esbuild.config.mjs', '--binary']);
run('node', ['scripts/embed-assets.mjs']);

// 4. Generate the SEA blob from the bundle + embedded assets.
run(process.execPath, ['--experimental-sea-config', 'sea-config.json']);

// 5. Assemble the executable from a copy of the base Node binary.
const outName = isWin ? 'mdsite.exe' : 'mdsite';
const outPath = path.join(buildDir, outName);
copyFileSync(baseNode, outPath);
chmodSync(outPath, 0o755); // node ships read-only (0555); postject needs write access

if (isMac) {
  // The blob can't be injected into a signed Mach-O; strip then re-sign ad-hoc.
  try {
    run('codesign', ['--remove-signature', outPath]);
  } catch {
    /* already unsigned */
  }
}

const postjectArgs = [
  'postject',
  outPath,
  'NODE_SEA_BLOB',
  path.join(buildDir, 'mdsite.blob'),
  '--sentinel-fuse',
  FUSE,
];
if (isMac) postjectArgs.push('--macho-segment-name', 'NODE_SEA');
run(npx, ['--yes', ...postjectArgs]);

if (isMac) {
  try {
    run('codesign', ['--sign', '-', outPath]);
  } catch {
    /* signing is best-effort locally */
  }
}

if (!isWin) await fs.chmod(outPath, 0o755);

const sizeMb = (statSync(outPath).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ Standalone binary: ${path.relative(root, outPath)} (${sizeMb} MB)`);
console.log(`  ${process.platform}/${process.arch} — run: ${outPath} --version`);
