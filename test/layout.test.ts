import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../src/core/build.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const read = (dir: string, rel: string) => fs.readFile(path.join(dir, rel), 'utf8');
const exists = (dir: string, rel: string) =>
  fs.access(path.join(dir, rel)).then(() => true).catch(() => false);

describe('layout: right rail (backlinks + graph toggle)', () => {
  let out: string;
  beforeAll(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-layout-'));
    await build({ cwd: fixtures, contentDir: '.', outDir: out });
  });
  afterAll(async () => {
    await fs.rm(out, { recursive: true, force: true });
  });

  it('places backlinks inside the right sidebar, after the main content', async () => {
    const html = await read(out, 'concepts/wikilinks/index.html');
    expect(html).toContain('class="backlinks"');
    const aside = html.indexOf('sidebar sidebar-right');
    const main = html.indexOf('</main>');
    const back = html.indexOf('class="backlinks"');
    expect(aside).toBeGreaterThan(-1);
    expect(back).toBeGreaterThan(main); // after the article
    expect(back).toBeGreaterThan(aside); // inside the right aside
  });

  it('shows a local/global graph toggle on note pages', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('data-graph-mode="local"');
    expect(html).toContain('data-graph-mode="global"');
  });

  it('omits the toggle on the generated home page (global only) but keeps the graph', async () => {
    const html = await read(out, 'index.html');
    expect(html).not.toContain('data-graph-mode');
    expect(html).toContain('data-graph');
  });
});

describe('layout: sidebar logo', () => {
  it('renders an emoji logo badge linking home', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-logo-'));
    const out = path.join(dir, 'out');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({ site: { logo: '🌱' } }),
    );
    await build({ cwd: dir, contentDir: fixtures, outDir: out });
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('class="sidebar-logo sidebar-logo-emoji"');
    expect(html).toContain('🌱');
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('renders an image logo when given an image path', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-logo2-'));
    const out = path.join(dir, 'out');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({ site: { logo: 'logo.png' } }),
    );
    await build({ cwd: dir, contentDir: fixtures, outDir: out });
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('class="sidebar-logo-img"');
    expect(html).toContain('src="/logo.png"');
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('build: landingPage semantics', () => {
  it("'' generates a notes-list home and keeps index.md as its own page", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-land-'));
    const out = path.join(dir, 'out');
    await fs.writeFile(path.join(dir, 'index.md'), '---\ntitle: Profile\n---\n\nHello there.');
    await fs.writeFile(path.join(dir, 'note.md'), '# Note\n');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({ build: { landingPage: '' } }),
    );
    await build({ cwd: dir, contentDir: '.', outDir: out });
    expect(await exists(out, 'index.html')).toBe(true); // generated notes-list home
    expect(await exists(out, 'index/index.html')).toBe(true); // index.md became /index/
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("'index.md' makes index.md the root and emits no /index/ page", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-land2-'));
    const out = path.join(dir, 'out');
    await fs.writeFile(path.join(dir, 'index.md'), '---\ntitle: Profile\n---\n\nHello there.');
    await fs.writeFile(path.join(dir, 'note.md'), '# Note\n');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({ build: { landingPage: 'index.md' } }),
    );
    await build({ cwd: dir, contentDir: '.', outDir: out });
    const home = await read(out, 'index.html');
    expect(home).toContain('Hello there.');
    expect(await exists(out, 'index/index.html')).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
