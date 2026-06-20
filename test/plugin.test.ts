import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../src/core/build.js';
import type { MdsitePlugin } from '../src/core/plugin.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const read = (dir: string, rel: string) => fs.readFile(path.join(dir, rel), 'utf8');
const exists = (dir: string, rel: string) =>
  fs.access(path.join(dir, rel)).then(() => true).catch(() => false);

describe('plugin hooks', () => {
  let out: string;
  const pagesSeen: string[] = [];

  const probe: MdsitePlugin = {
    name: 'probe',
    page(page) {
      pagesSeen.push(page.slug);
    },
    head() {
      return '<meta name="x-probe" content="head">';
    },
    bodyEnd() {
      return '<div data-probe-bodyend></div>';
    },
    emit() {
      return [{ path: 'probe-emitted.txt', content: 'hello from a plugin' }];
    },
  };

  beforeAll(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'mdsite-plugin-'));
    await build({ cwd: fixtures, contentDir: '.', outDir: out, plugins: [probe] });
  });
  afterAll(async () => {
    await fs.rm(out, { recursive: true, force: true });
  });

  it('invokes the page hook for every note', () => {
    expect(pagesSeen.length).toBeGreaterThan(0);
    expect(pagesSeen).toContain('concepts/wikilinks');
  });

  it('injects head and bodyEnd HTML into rendered pages', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('name="x-probe"');
    expect(html).toContain('data-probe-bodyend');
  });

  it('writes files returned by the emit hook', async () => {
    expect(await exists(out, 'probe-emitted.txt')).toBe(true);
    expect(await read(out, 'probe-emitted.txt')).toBe('hello from a plugin');
  });
});
