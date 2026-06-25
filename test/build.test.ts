import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../src/core/build.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Build the fixtures once into a temp dir and read files back for assertions. */
async function buildFixtures(overrides: Record<string, unknown> = {}): Promise<string> {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-test-'));
  await build({ cwd: fixtures, contentDir: '.', outDir: out, ...overrides });
  return out;
}

const read = (dir: string, rel: string) => fs.readFile(path.join(dir, rel), 'utf8');
const exists = (dir: string, rel: string) =>
  fs.access(path.join(dir, rel)).then(() => true).catch(() => false);

describe('build (fixtures)', () => {
  let out: string;
  beforeAll(async () => {
    out = await buildFixtures();
  });
  afterAll(async () => {
    await fs.rm(out, { recursive: true, force: true });
  });

  it('emits a page per markdown file (+ generated home)', async () => {
    expect(await exists(out, 'index.html')).toBe(true);
    expect(await exists(out, 'getting-started/index.html')).toBe(true);
    expect(await exists(out, 'concepts/wikilinks/index.html')).toBe(true);
    // malformed frontmatter must still build (the Quartz failure we fixed)
    expect(await exists(out, 'notes/broken-frontmatter/index.html')).toBe(true);
  });

  it('resolves known wikilinks and marks unknown ones broken', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('href="/concepts/wikilinks/"');
    expect(html).toContain('wikilink-broken'); // [[Nonexistent Note]]
  });

  it('copies attachments', async () => {
    expect(await exists(out, 'attachments/diagram.svg')).toBe(true);
  });

  it('emits feeds, search index, graph, styles, 404', async () => {
    for (const f of [
      'sitemap.xml',
      'rss.xml',
      'search-index.json',
      'graph.json',
      'styles.css',
      '404.html',
    ]) {
      expect(await exists(out, f), f).toBe(true);
    }
  });

  it('wires the client runtime script into pages', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('mdgarden.client.js');
  });

  it('shows a reading-time estimate in page meta', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toMatch(/reading-time">\d+ min read/);
  });

  it('renders breadcrumbs on nested pages', async () => {
    const html = await read(out, 'concepts/wikilinks/index.html');
    expect(html).toContain('class="breadcrumbs"');
    expect(html).toContain('>Concepts<');
  });

  it('renders a folder-tree explorer sidebar', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('explorer-list');
    expect(html).toContain('explorer-folder');
    expect(html).toContain('folder-label');
  });

  it('generates a folder index for folders without their own index.md', async () => {
    expect(await exists(out, 'concepts/index.html')).toBe(true);
    const html = await read(out, 'concepts/index.html');
    expect(html).toContain('href="/concepts/wikilinks/"');
  });

  it('renders mermaid fences as <pre class="mermaid"> and ships the chunk', async () => {
    const html = await read(out, 'concepts/diagram/index.html');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain('graph TD');
    expect(await exists(out, 'mdgarden.mermaid.js')).toBe(true);
  });

  it('adds intrinsic width/height + lazy loading to embedded images', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('class="md-embed"');
    expect(html).toContain('width="160" height="60"');
    expect(html).toContain('loading="lazy"');
  });

  it('honors a frontmatter permalink and emits alias redirects', async () => {
    // permalink override: note renders at custom/path, not notes/aliased
    expect(await exists(out, 'custom/path/index.html')).toBe(true);
    expect(await exists(out, 'notes/aliased/index.html')).toBe(false);
    // each alias becomes a redirect stub pointing at the real URL
    const redirect = await read(out, 'old-name/index.html');
    expect(redirect).toContain('url=/custom/path/');
    expect(redirect).toContain('rel="canonical" href="/custom/path/"');
    expect(await exists(out, 'archive/legacy/index.html')).toBe(true);
  });

  it('does not inject comments unless configured', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).not.toContain('giscus.app');
  });
});

describe('social / OG tags', () => {
  let dir: string;
  let out: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-og-'));
    out = path.join(dir, 'out');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({ site: { baseUrl: 'https://example.com', image: '/card.png' } }),
    );
    await build({ cwd: dir, contentDir: fixtures, outDir: out });
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('emits canonical, og:url, og:image and twitter card with absolute URLs', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('<link rel="canonical" href="https://example.com/getting-started/"');
    expect(html).toContain('property="og:url" content="https://example.com/getting-started/"');
    expect(html).toContain('property="og:image" content="https://example.com/card.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('emits robots.txt with an absolute Sitemap line', async () => {
    const robots = await read(out, 'robots.txt');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
  });
});

describe('comments (giscus)', () => {
  let dir: string;
  let out: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-comments-'));
    out = path.join(dir, 'out');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({
        features: { comments: true },
        comments: {
          provider: 'giscus',
          repo: 'me/notes',
          repoId: 'R_x',
          category: 'General',
          categoryId: 'C_x',
        },
      }),
    );
    await build({ cwd: dir, contentDir: fixtures, outDir: out });
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('injects the giscus widget on notes but not on the 404 page', async () => {
    const note = await read(out, 'getting-started/index.html');
    expect(note).toContain('giscus.app/client.js');
    expect(note).toContain('data-repo="me/notes"');
    const notFound = await read(out, '404.html');
    expect(notFound).not.toContain('giscus.app');
  });
});

describe('i18n', () => {
  let dir: string;
  let out: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-i18n-'));
    out = path.join(dir, 'out');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({ ui: { onThisPage: 'Sur cette page', notes: 'Carnets' } }),
    );
    await build({ cwd: dir, contentDir: fixtures, outDir: out });
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('applies ui overrides to built-in strings', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('Sur cette page');
    expect(html).toContain('Carnets');
    expect(html).not.toContain('<h2>On this page</h2>');
  });
});

describe('build with basePath', () => {
  let dir: string;
  let out: string;
  beforeAll(async () => {
    // A temp config dir carrying basePath, pointed at the shared fixtures.
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-base-'));
    out = path.join(dir, 'out');
    await fs.writeFile(
      path.join(dir, 'mdgarden.config.json'),
      JSON.stringify({ build: { basePath: '/notes' } }),
    );
    await build({ cwd: dir, contentDir: fixtures, outDir: out });
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('prefixes asset, css, client and page hrefs with the base path', async () => {
    const html = await read(out, 'getting-started/index.html');
    expect(html).toContain('href="/notes/styles.css"');
    expect(html).toContain('src="/notes/mdgarden.client.js"');
    expect(html).toContain('data-base="/notes"');
    expect(html).toContain('href="/notes/concepts/wikilinks/"'); // resolved wikilink
  });
});
