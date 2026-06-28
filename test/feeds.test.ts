import { afterEach, describe, expect, it } from 'vitest';
import { buildRobots, buildRss, buildSitemap } from '../src/features/feeds.js';
import { setBasePath } from '../src/parser/links.js';
import { DEFAULT_CONFIG } from '../src/core/config.js';
import type { MdsiteConfig, Page } from '../src/types.js';

afterEach(() => setBasePath(undefined));

function page(overrides: Partial<Page>): Page {
  return {
    sourcePath: '',
    slug: '',
    outPath: '',
    url: '/',
    title: 'Untitled',
    description: '',
    frontmatter: {},
    body: '',
    tags: [],
    draft: false,
    aliases: [],
    words: 0,
    readingTime: 0,
    links: [],
    backlinks: [],
    html: '',
    headings: [],
    ...overrides,
  };
}

describe('buildSitemap', () => {
  it('emits one <url> per page with an absolute, escaped <loc>', () => {
    const xml = buildSitemap([page({ url: '/a/' }), page({ url: '/b/' })], 'https://example.com');
    expect(xml).toContain('<loc>https://example.com/a/</loc>');
    expect(xml).toContain('<loc>https://example.com/b/</loc>');
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
  });

  it('includes <lastmod> only for pages with a date', () => {
    const xml = buildSitemap([page({ url: '/dated/', date: '2026-01-15' })], 'https://example.com');
    expect(xml).toContain('<lastmod>2026-01-15</lastmod>');
  });

  it('omits <lastmod> when no date is set', () => {
    const xml = buildSitemap([page({ url: '/nodate/' })], 'https://example.com');
    expect(xml).not.toContain('<lastmod>');
  });
});

describe('buildRss', () => {
  const config: MdsiteConfig = {
    ...DEFAULT_CONFIG,
    site: { ...DEFAULT_CONFIG.site, title: 'My Garden', description: 'Notes', baseUrl: 'https://example.com' },
  };

  it('only includes dated pages, newest first, capped at 20', () => {
    const pages = [
      page({ url: '/old/', title: 'Old', date: '2024-01-01' }),
      page({ url: '/new/', title: 'New', date: '2026-01-01' }),
      page({ url: '/undated/', title: 'Undated' }),
    ];
    const xml = buildRss(pages, config);
    const newIdx = xml.indexOf('/new/');
    const oldIdx = xml.indexOf('/old/');
    expect(newIdx).toBeGreaterThan(-1);
    expect(oldIdx).toBeGreaterThan(newIdx);
    expect(xml).not.toContain('/undated/');
  });

  it('escapes title/description and includes the channel description', () => {
    const xml = buildRss([page({ url: '/x/', title: 'A & B', date: '2026-01-01' })], config);
    expect(xml).toContain('<title>A &amp; B</title>');
    expect(xml).toContain('<description>Notes</description>');
  });
});

describe('buildRobots', () => {
  it('allows everything and omits Sitemap when there is no baseUrl', () => {
    const txt = buildRobots(DEFAULT_CONFIG);
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).not.toContain('Sitemap:');
  });

  it('adds an absolute Sitemap line when baseUrl is set', () => {
    const config: MdsiteConfig = { ...DEFAULT_CONFIG, site: { ...DEFAULT_CONFIG.site, baseUrl: 'https://example.com/' } };
    const txt = buildRobots(config);
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('honors a configured basePath in the Sitemap URL', () => {
    setBasePath('/notes');
    const config: MdsiteConfig = { ...DEFAULT_CONFIG, site: { ...DEFAULT_CONFIG.site, baseUrl: 'https://example.com' } };
    const txt = buildRobots(config);
    expect(txt).toContain('Sitemap: https://example.com/notes/sitemap.xml');
  });
});
