import { afterEach, describe, expect, it } from 'vitest';
import { buildTree, listFolders } from '../src/features/explorer.js';
import { setBasePath } from '../src/parser/links.js';
import type { Page } from '../src/types.js';

afterEach(() => setBasePath(undefined));

function page(slug: string, title: string): Page {
  return {
    sourcePath: '',
    slug,
    outPath: '',
    url: `/${slug}/`,
    title,
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
  };
}

describe('buildTree', () => {
  it('skips the home page and builds top-level leaves for flat notes', () => {
    const tree = buildTree([page('', 'Home'), page('getting-started', 'Getting Started')]);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ name: 'Getting Started', slug: 'getting-started', isFolder: false });
  });

  it('creates intermediate folder nodes for nested slugs', () => {
    const tree = buildTree([page('concepts/wikilinks', 'Wikilinks')]);
    expect(tree).toHaveLength(1);
    const folder = tree[0];
    expect(folder.isFolder).toBe(true);
    expect(folder.name).toBe('Concepts'); // humanized, no own index page
    expect(folder.children).toHaveLength(1);
    expect(folder.children[0]).toMatchObject({ name: 'Wikilinks', slug: 'concepts/wikilinks', isFolder: false });
  });

  it('uses the real note title for a folder that has its own index page', () => {
    const tree = buildTree([page('concepts', 'Concepts Overview'), page('concepts/wikilinks', 'Wikilinks')]);
    const folder = tree[0];
    expect(folder.name).toBe('Concepts Overview');
    expect(folder.page?.title).toBe('Concepts Overview');
    expect(folder.children).toHaveLength(1);
  });

  it('sorts folders before files, then alphabetically by name', () => {
    const tree = buildTree([
      page('zebra', 'Zebra'),
      page('apple/leaf', 'Leaf'),
      page('banana', 'Banana'),
    ]);
    expect(tree.map((n) => n.name)).toEqual(['Apple', 'Banana', 'Zebra']);
    expect(tree[0].isFolder).toBe(true);
    expect(tree[1].isFolder).toBe(false);
  });
});

describe('listFolders', () => {
  it('flattens nested folders recursively, excluding leaf notes', () => {
    const tree = buildTree([
      page('a/b/c', 'C'),
      page('a/d', 'D'),
    ]);
    const folders = listFolders(tree);
    expect(folders.map((f) => f.slug).sort()).toEqual(['a', 'a/b']);
  });

  it('returns an empty array when there are no folders', () => {
    const tree = buildTree([page('flat', 'Flat')]);
    expect(listFolders(tree)).toEqual([]);
  });
});
