import { describe, expect, it } from 'vitest';
import { buildGraph, buildSearchIndex } from '../src/features/data.js';
import type { Page } from '../src/types.js';

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

describe('buildSearchIndex', () => {
  it('serializes one doc per page with stripped html content', () => {
    const pages = [
      page({ slug: 'a', url: '/a/', title: 'A', tags: ['x', 'y'], html: '<p>Hello <b>world</b></p>' }),
      page({ slug: 'b', url: '/b/', title: 'B', tags: [], html: '<p>Second</p>' }),
    ];
    const docs = JSON.parse(buildSearchIndex(pages));
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ id: '0', url: '/a/', title: 'A', tags: 'x y', content: 'Hello world' });
    expect(docs[1]).toMatchObject({ id: '1', url: '/b/', title: 'B', tags: '', content: 'Second' });
  });

  it('truncates content to 4000 characters', () => {
    const longHtml = `<p>${'x'.repeat(5000)}</p>`;
    const docs = JSON.parse(buildSearchIndex([page({ html: longHtml })]));
    expect(docs[0].content.length).toBe(4000);
  });

  it('returns an empty array for no pages', () => {
    expect(JSON.parse(buildSearchIndex([]))).toEqual([]);
  });
});

describe('buildGraph', () => {
  it('builds nodes for every page and links for valid outgoing references', () => {
    const pages = [
      page({ slug: 'a', url: '/a/', title: 'A', links: ['b'] }),
      page({ slug: 'b', url: '/b/', title: 'B', links: ['a'] }),
    ];
    const graph = JSON.parse(buildGraph(pages));
    expect(graph.nodes).toEqual([
      { id: 'a', title: 'A', url: '/a/' },
      { id: 'b', title: 'B', url: '/b/' },
    ]);
    expect(graph.links).toEqual([
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ]);
  });

  it('drops links to unknown slugs and self-links', () => {
    const pages = [page({ slug: 'a', url: '/a/', title: 'A', links: ['ghost', 'a'] })];
    const graph = JSON.parse(buildGraph(pages));
    expect(graph.links).toEqual([]);
  });

  it('dedupes duplicate links between the same two pages', () => {
    const pages = [
      page({ slug: 'a', url: '/a/', title: 'A', links: ['b', 'b'] }),
      page({ slug: 'b', url: '/b/', title: 'B', links: [] }),
    ];
    const graph = JSON.parse(buildGraph(pages));
    expect(graph.links).toEqual([{ source: 'a', target: 'b' }]);
  });
});
