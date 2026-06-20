import { describe, expect, it } from 'vitest';
import { outPathForSlug, slugifyPath, tagUrl, urlForSlug } from '../src/parser/links.js';

describe('links', () => {
  it('slugifies content paths and collapses index', () => {
    expect(slugifyPath('Concepts/Wikilinks.md')).toBe('concepts/wikilinks');
    expect(slugifyPath('index.md')).toBe('');
    expect(slugifyPath('A/B/index.md')).toBe('a/b');
    expect(slugifyPath('My Note.md')).toBe('my-note');
  });

  it('builds root-relative urls', () => {
    expect(urlForSlug('')).toBe('/');
    expect(urlForSlug('concepts/wikilinks')).toBe('/concepts/wikilinks/');
    expect(outPathForSlug('a/b')).toBe('a/b/index.html');
    expect(outPathForSlug('')).toBe('index.html');
    expect(tagUrl('Guide')).toBe('/tags/guide/');
  });
});
