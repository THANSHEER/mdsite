import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Wipe and recreate the output directory. */
export async function ensureCleanDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

/** Write a file under outDir, creating parent folders as needed. */
export async function writeOut(
  outDir: string,
  relPath: string,
  content: string | Uint8Array,
): Promise<void> {
  const dest = path.join(outDir, relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content);
}

/** Copy a content asset (image, pdf, …) to its output path. */
export async function copyAsset(
  contentDir: string,
  sourceRel: string,
  outDir: string,
  outRel: string,
): Promise<void> {
  const src = path.join(contentDir, sourceRel);
  const dest = path.join(outDir, outRel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

// The bundled browser runtime and KaTeX assets are resolved by `assets.ts`
// (disk in npm mode, embedded assets in the standalone binary).
