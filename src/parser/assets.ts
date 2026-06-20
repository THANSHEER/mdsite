// Resolve static assets from disk or Node SEA.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Fallback if import.meta.url is undefined.
const requireFrom = createRequire(import.meta.url || process.execPath);

interface SeaApi {
  isSea(): boolean;
  getAsset(key: string): ArrayBuffer;
  getAsset(key: string, encoding: string): string;
}

let seaApi: SeaApi | undefined;
try {
  seaApi = requireFrom('node:sea') as SeaApi;
} catch {
  seaApi = undefined; // Older Node without the module — never a SEA.
}

/** True only when running inside a packaged single-executable build. */
export function inSea(): boolean {
  try {
    return seaApi?.isSea() ?? false;
  } catch {
    return false;
  }
}


export const SEA_CLIENT_KEY = 'mdsite.client.js';
export const SEA_MERMAID_KEY = 'mdsite.mermaid.js';
export const SEA_KATEX_CSS_KEY = 'katex.min.css';
export const SEA_KATEX_FONTS_MANIFEST_KEY = 'katex/fonts.json';
export const seaKatexFontKey = (name: string): string => `katex/fonts/${name}`;

/** Get candidate paths for client chunk on disk. */
function clientChunkDiskPaths(name: string): string[] {
  const out: string[] = [];
  // import.meta.url can be invalid in the CJS bundle when run outside a real SEA;
  // resolve defensively so a build degrades to "no client JS" instead of crashing.
  for (const rel of [`./client/${name}`, `../../dist/client/${name}`]) {
    try {
      out.push(fileURLToPath(new URL(rel, import.meta.url)));
    } catch {
      // unresolvable here — skip this candidate
    }
  }
  return out;
}

/** The installed `katex/dist` directory (npm mode). */
function katexDistDir(): string {
  return path.join(path.dirname(requireFrom.resolve('katex/package.json')), 'dist');
}

/**
 * The bundled browser runtime (dark-mode, search, graph, nav) as a string.
 * Returns '' if it can't be found, so a build degrades to no client JS rather
 * than failing.
 */
export async function getClientRuntime(): Promise<string> {
  return getClientChunk(SEA_CLIENT_KEY);
}

/** The lazily-loaded mermaid chunk, or '' when unavailable (diagrams degrade). */
export async function getMermaidRuntime(): Promise<string> {
  return getClientChunk(SEA_MERMAID_KEY);
}

/** Read a bundled client chunk by its file name (= its SEA asset key). */
async function getClientChunk(name: string): Promise<string> {
  if (inSea()) {
    try {
      return seaApi!.getAsset(name, 'utf8');
    } catch {
      return '';
    }
  }
  for (const candidate of clientChunkDiskPaths(name)) {
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch {
      // try next candidate
    }
  }
  return '';
}

/** KaTeX stylesheet contents (self-hosted, no CDN). */
export async function getKatexCss(): Promise<string> {
  if (inSea()) {
    return seaApi!.getAsset(SEA_KATEX_CSS_KEY, 'utf8');
  }
  return fs.readFile(path.join(katexDistDir(), 'katex.min.css'), 'utf8');
}

/** Write all KaTeX font files into `destFontsDir` (created if needed). */
export async function writeKatexFonts(destFontsDir: string): Promise<void> {
  await fs.mkdir(destFontsDir, { recursive: true });
  if (inSea()) {
    const manifest = JSON.parse(
      seaApi!.getAsset(SEA_KATEX_FONTS_MANIFEST_KEY, 'utf8'),
    ) as string[];
    for (const name of manifest) {
      const buf = seaApi!.getAsset(seaKatexFontKey(name));
      await fs.writeFile(path.join(destFontsDir, name), Buffer.from(buf));
    }
    return;
  }
  await fs.cp(path.join(katexDistDir(), 'fonts'), destFontsDir, { recursive: true });
}
