import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { majorVersion } from '../src/core/build.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('majorVersion', () => {
  it('extracts the leading integer from plain and "v"-prefixed semver strings', () => {
    expect(majorVersion('2.1.0')).toBe(2);
    expect(majorVersion('v2.1.0')).toBe(2);
    expect(majorVersion('10.0.0')).toBe(10);
    expect(majorVersion('0.1.0')).toBe(0);
  });

  it('returns null for unparseable strings', () => {
    expect(majorVersion('unknown')).toBeNull();
    expect(majorVersion('')).toBeNull();
  });
});

describe('build: version manifest + generator tag', () => {
  let out: string;
  beforeEach(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-version-'));
  });
  afterEach(async () => {
    await fs.rm(out, { recursive: true, force: true });
  });

  it('writes mdgarden-meta.json with the current version and a valid timestamp', async () => {
    const { build } = await import('../src/core/build.js');
    await build({ cwd: fixtures, contentDir: '.', outDir: out });

    const meta = JSON.parse(await fs.readFile(path.join(out, 'mdgarden-meta.json'), 'utf8'));
    expect(typeof meta.version).toBe('string');
    expect(Number.isNaN(new Date(meta.builtAt).getTime())).toBe(false);
  });

  it('stamps every rendered page with a <meta name="generator"> tag', async () => {
    const { build } = await import('../src/core/build.js');
    await build({ cwd: fixtures, contentDir: '.', outDir: out });

    const html = await fs.readFile(path.join(out, 'getting-started/index.html'), 'utf8');
    expect(html).toMatch(/<meta name="generator" content="mdgarden [^"]+">/);
  });
});

describe('build: major-version-jump warning', () => {
  let out: string;
  beforeEach(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-version-warn-'));
  });
  afterEach(async () => {
    await fs.rm(out, { recursive: true, force: true });
    vi.resetModules();
    vi.doUnmock('../src/version.js');
  });

  it('warns when rebuilding a site over an older major version', async () => {
    vi.doMock('../src/version.js', () => ({ VERSION: '2.0.0' }));
    vi.resetModules();
    const { build } = await import('../src/core/build.js');

    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(
      path.join(out, 'mdgarden-meta.json'),
      JSON.stringify({ version: '1.4.0', builtAt: '2025-01-01T00:00:00.000Z' }),
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await build({ cwd: fixtures, contentDir: '.', outDir: out });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('v1.4.0'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('v2.0.0'));
    warn.mockRestore();
  });

  it('does not warn when the major version is unchanged', async () => {
    vi.doMock('../src/version.js', () => ({ VERSION: '1.9.0' }));
    vi.resetModules();
    const { build } = await import('../src/core/build.js');

    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(
      path.join(out, 'mdgarden-meta.json'),
      JSON.stringify({ version: '1.4.0', builtAt: '2025-01-01T00:00:00.000Z' }),
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await build({ cwd: fixtures, contentDir: '.', outDir: out });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn on a fresh outDir with no previous manifest', async () => {
    const { build } = await import('../src/core/build.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await build({ cwd: fixtures, contentDir: '.', outDir: out });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
