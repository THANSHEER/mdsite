import { afterEach, describe, expect, it } from 'vitest';
import { createMarkdown } from '../src/parser/markdown.js';
import { buildSiteIndex, makeRenderEnv, setBasePath } from '../src/parser/links.js';
import { DEFAULT_CONFIG } from '../src/core/config.js';
import type { Page } from '../src/types.js';

afterEach(() => setBasePath(undefined));

function emptyEnv() {
  return makeRenderEnv(buildSiteIndex([], []));
}

describe('createMarkdown: callouts', () => {
  const md = createMarkdown(DEFAULT_CONFIG);

  it('turns an Obsidian-style callout blockquote into a styled div', () => {
    const html = md.render('> [!note] Heads up\n> Body text here.\n', emptyEnv());
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('data-callout="note"');
    expect(html).toContain('callout-title');
    expect(html).toContain('Heads up');
    expect(html).toContain('Body text here.');
  });

  it('marks a "+"-suffixed callout as collapsible', () => {
    const html = md.render('> [!tip]+ Pro tip\n> Detail.\n', emptyEnv());
    expect(html).toContain('is-collapsible');
  });

  it('falls back to a capitalized type as the title when none is given', () => {
    const html = md.render('> [!warning]\n> Be careful.\n', emptyEnv());
    expect(html).toContain('Warning');
  });

  it('leaves a plain blockquote (no [!type]) untouched', () => {
    const html = md.render('> just a quote\n', emptyEnv());
    expect(html).not.toContain('callout');
    expect(html).toContain('<blockquote>');
  });
});

describe('createMarkdown: task lists', () => {
  const md = createMarkdown(DEFAULT_CONFIG);

  it('renders checked and unchecked checkboxes', () => {
    const html = md.render('- [ ] todo\n- [x] done\n', emptyEnv());
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });
});

describe('createMarkdown: footnotes', () => {
  const md = createMarkdown(DEFAULT_CONFIG);

  it('renders a footnote reference and its definition', () => {
    const html = md.render('Body text.[^1]\n\n[^1]: The note.\n', emptyEnv());
    expect(html).toContain('footnote-ref');
    expect(html).toContain('The note.');
  });
});

describe('createMarkdown: headings + TOC collection', () => {
  const md = createMarkdown(DEFAULT_CONFIG);

  it('collects headings into env.headings with slugs', () => {
    const env = emptyEnv();
    md.render('## First Section\n\ntext\n\n### Sub Heading\n', env);
    expect(env.headings).toEqual([
      { level: 2, text: 'First Section', slug: 'first-section' },
      { level: 3, text: 'Sub Heading', slug: 'sub-heading' },
    ]);
  });
});

describe('createMarkdown: figure wrapping', () => {
  const md = createMarkdown(DEFAULT_CONFIG);

  it('wraps a standalone image paragraph in <figure>, using its title as caption', () => {
    const html = md.render('![alt text](pic.png "A caption")\n', emptyEnv());
    expect(html).toContain('<figure class="md-figure">');
    expect(html).toContain('<figcaption>A caption</figcaption>');
  });

  it('does not wrap an image that shares a paragraph with other text', () => {
    const html = md.render('![alt](pic.png) and some text\n', emptyEnv());
    expect(html).not.toContain('<figure');
  });
});

describe('createMarkdown: wikilinks', () => {
  function pages(): Page[] {
    return [
      {
        sourcePath: '', slug: 'target', outPath: '', url: '/target/', title: 'Target',
        description: '', frontmatter: {}, body: '', tags: [], draft: false, aliases: [],
        words: 0, readingTime: 0, links: [], backlinks: [], html: '', headings: [],
      },
    ];
  }

  it('resolves a known [[wikilink]] and records the outgoing link', () => {
    const md = createMarkdown(DEFAULT_CONFIG);
    const index = buildSiteIndex(pages(), []);
    const env = makeRenderEnv(index);
    const html = md.render('See [[Target]] for more.\n', env);
    expect(html).toContain('href="/target/"');
    expect(html).toContain('class="wikilink"');
    expect(env.outgoing.has('target')).toBe(true);
  });

  it('marks an unknown [[wikilink]] as broken without recording an outgoing link', () => {
    const md = createMarkdown(DEFAULT_CONFIG);
    const env = emptyEnv();
    const html = md.render('See [[Nonexistent]].\n', env);
    expect(html).toContain('wikilink-broken');
    expect(env.outgoing.size).toBe(0);
  });

  it('supports the alias pipe syntax [[target|alias]]', () => {
    const md = createMarkdown(DEFAULT_CONFIG);
    const html = md.render('[[Target|See here]]\n', makeRenderEnv(buildSiteIndex(pages(), [])));
    expect(html).toContain('>See here<');
  });
});

describe('createMarkdown: mermaid fences', () => {
  it('renders mermaid fences as <pre class="mermaid"> when enabled', () => {
    const md = createMarkdown(DEFAULT_CONFIG);
    const html = md.render('```mermaid\ngraph TD; A-->B;\n```\n', emptyEnv());
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain('graph TD');
  });

  it('falls back to a normal code block when mermaid is disabled', () => {
    const config = { ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, mermaid: false } };
    const md = createMarkdown(config);
    const html = md.render('```mermaid\ngraph TD; A-->B;\n```\n', emptyEnv());
    expect(html).not.toContain('<pre class="mermaid">');
    expect(html).toContain('<pre><code');
  });
});
