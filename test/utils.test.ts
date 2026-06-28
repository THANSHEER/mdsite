import { describe, expect, it } from 'vitest';
import { capitalize, escapeAttr, escapeHtml, humanizeSlug, stripHtml, t } from '../src/utils.js';

describe('escapeHtml', () => {
  it('escapes &, < and >', () => {
    expect(escapeHtml('<b>a & b</b>')).toBe('&lt;b&gt;a &amp; b&lt;/b&gt;');
  });

  it('leaves quotes untouched', () => {
    expect(escapeHtml('say "hi"')).toBe('say "hi"');
  });
});

describe('escapeAttr', () => {
  it('also escapes double quotes', () => {
    expect(escapeAttr('say "hi" & <bye>')).toBe('say &quot;hi&quot; &amp; &lt;bye&gt;');
  });
});

describe('capitalize', () => {
  it('uppercases the first character only', () => {
    expect(capitalize('note')).toBe('Note');
    expect(capitalize('NOTE')).toBe('NOTE');
  });

  it('returns empty string unchanged', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('humanizeSlug', () => {
  it('replaces dashes/underscores with spaces and title-cases words', () => {
    expect(humanizeSlug('my-folder')).toBe('My Folder');
    expect(humanizeSlug('ai_notes')).toBe('Ai Notes');
  });

  it('handles a single word', () => {
    expect(humanizeSlug('notes')).toBe('Notes');
  });
});

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello   <b>world</b></p>')).toBe('Hello world');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtml('&lt;tag&gt; &amp; &quot;quote&quot; &#39;s&#39;')).toBe('<tag> & "quote" \'s\'');
  });

  it('trims leading/trailing whitespace', () => {
    expect(stripHtml('  <p> padded </p>  ')).toBe('padded');
  });
});

describe('t (i18n)', () => {
  it('returns the built-in string when no override is configured', () => {
    expect(t('notes')).toBe('Notes');
    expect(t('notes', {})).toBe('Notes');
  });

  it('prefers a ui override when present', () => {
    expect(t('notes', { ui: { notes: 'Carnets' } })).toBe('Carnets');
  });

  it('falls back to the built-in string for keys not overridden', () => {
    expect(t('graph', { ui: { notes: 'Carnets' } })).toBe('Graph');
  });
});
