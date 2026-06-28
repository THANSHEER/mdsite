import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getClientRuntime,
  getKatexCss,
  getMermaidRuntime,
  inSea,
  writeKatexFonts,
} from '../src/parser/assets.js';

describe('inSea', () => {
  it('is false in a normal Node test run', () => {
    expect(inSea()).toBe(false);
  });
});

describe('getKatexCss', () => {
  it('reads the installed KaTeX stylesheet from node_modules', async () => {
    const css = await getKatexCss();
    expect(css).toContain('.katex');
    expect(css.length).toBeGreaterThan(100);
  });
});

describe('getClientRuntime / getMermaidRuntime', () => {
  it('return strings (bundled chunk contents, or "" if not built yet)', async () => {
    expect(typeof (await getClientRuntime())).toBe('string');
    expect(typeof (await getMermaidRuntime())).toBe('string');
  });
});

describe('writeKatexFonts', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  it('copies KaTeX font files into the destination directory', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-fonts-'));
    const dest = path.join(dir, 'fonts');
    await writeKatexFonts(dest);
    const files = await fs.readdir(dest);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('.woff2'))).toBe(true);
  });
});
