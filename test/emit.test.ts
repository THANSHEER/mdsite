import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyAsset, ensureCleanDir, writeOut } from '../src/core/emit.js';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-emit-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('ensureCleanDir', () => {
  it('creates the directory when it does not exist', async () => {
    const target = path.join(dir, 'fresh');
    await ensureCleanDir(target);
    expect((await fs.stat(target)).isDirectory()).toBe(true);
  });

  it('wipes pre-existing contents', async () => {
    const target = path.join(dir, 'out');
    await fs.mkdir(target);
    await fs.writeFile(path.join(target, 'stale.html'), 'old');
    await ensureCleanDir(target);
    expect(await fs.readdir(target)).toEqual([]);
  });
});

describe('writeOut', () => {
  it('writes a file, creating parent directories as needed', async () => {
    await writeOut(dir, 'a/b/c.html', '<h1>hi</h1>');
    const content = await fs.readFile(path.join(dir, 'a/b/c.html'), 'utf8');
    expect(content).toBe('<h1>hi</h1>');
  });

  it('accepts binary content', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await writeOut(dir, 'bin/data.bin', bytes);
    const buf = await fs.readFile(path.join(dir, 'bin/data.bin'));
    expect(new Uint8Array(buf)).toEqual(bytes);
  });
});

describe('copyAsset', () => {
  it('copies a file from contentDir to outDir at a (possibly different) relative path', async () => {
    const contentDir = path.join(dir, 'content');
    const outDir = path.join(dir, 'out');
    await fs.mkdir(path.join(contentDir, 'attachments'), { recursive: true });
    await fs.writeFile(path.join(contentDir, 'attachments/img.png'), 'fake-png-bytes');

    await copyAsset(contentDir, 'attachments/img.png', outDir, 'assets/img.png');

    const copied = await fs.readFile(path.join(outDir, 'assets/img.png'), 'utf8');
    expect(copied).toBe('fake-png-bytes');
  });
});
