import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import anchor from 'markdown-it-anchor';
import taskLists from 'markdown-it-task-lists';
import { katex } from '@mdit/plugin-katex';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import { anchorSlug } from './links.js';
import { capitalize, escapeAttr, escapeHtml } from '../utils.js';
import type { HighlightFn } from './highlight.js';
import type { MdsitePlugin } from '../core/plugin.js';
import type { MdsiteConfig, RenderEnv } from '../types.js';

const OPEN_BRACKET = 0x5b; // [
const BANG = 0x21; // !

/** Inline rule for Obsidian wikilinks and embeds. */
function wikilinkRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  let pos = state.pos;
  let isEmbed = false;
  if (src.charCodeAt(pos) === BANG) {
    isEmbed = true;
    pos++;
  }
  if (src.charCodeAt(pos) !== OPEN_BRACKET || src.charCodeAt(pos + 1) !== OPEN_BRACKET) {
    return false;
  }
  const contentStart = pos + 2;
  const close = src.indexOf(']]', contentStart);
  if (close < 0) return false;
  const inner = src.slice(contentStart, close);
  if (inner.includes('\n') || inner.includes('[')) return false;

  if (silent) {
    state.pos = close + 2;
    return true;
  }

  const env = state.env as RenderEnv;

  let target = inner;
  let alias = '';
  let anchorText = '';
  const pipe = inner.indexOf('|');
  if (pipe >= 0) {
    alias = inner.slice(pipe + 1).trim();
    target = inner.slice(0, pipe);
  }
  const hash = target.indexOf('#');
  if (hash >= 0) {
    anchorText = target.slice(hash + 1).trim();
    target = target.slice(0, hash);
  }
  target = target.trim();

  let html: string;
  if (isEmbed) {
    const e = env.resolveEmbed(target, alias);
    if (e.kind === 'image') {
      const dim = e.width && e.height ? ` width="${e.width}" height="${e.height}"` : '';
      html = `<img src="${escapeAttr(e.src)}" alt="${escapeAttr(e.alt)}" loading="lazy" decoding="async"${dim} class="md-embed">`;
    } else {
      const cls = e.resolved ? 'wikilink wikilink-embed' : 'wikilink wikilink-embed wikilink-broken';
      html = `<a href="${escapeAttr(e.url)}" class="${cls}">${escapeHtml(e.title)}</a>`;
    }
  } else {
    const r = env.resolveLink(target, anchorText);
    const text = alias || (target ? target : anchorText ? `#${anchorText}` : inner);
    const cls = r.resolved ? 'wikilink' : 'wikilink wikilink-broken';
    html = `<a href="${escapeAttr(r.url)}" class="${cls}">${escapeHtml(text)}</a>`;
  }

  const token = state.push('html_inline', '', 0);
  token.content = html;
  state.pos = close + 2;
  return true;
}

/** Core rule for callouts. */
function calloutsRule(state: StateCore): void {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'blockquote_open') continue;
    const paraOpen = tokens[i + 1];
    const inline = tokens[i + 2];
    if (!paraOpen || paraOpen.type !== 'paragraph_open') continue;
    if (!inline || inline.type !== 'inline') continue;

    const m = /^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)/.exec(inline.content);
    if (!m) continue;

    try {
      const type = m[1].toLowerCase();
      const collapsible = m[2] !== '';
      const titleText = m[3].trim() || capitalize(type);
      const newlineIdx = inline.content.indexOf('\n');
      const bodyText = newlineIdx >= 0 ? inline.content.slice(newlineIdx + 1) : '';

      const open = tokens[i];
      open.tag = 'div';
      open.attrSet('class', `callout callout-${type}${collapsible ? ' is-collapsible' : ''}`);
      open.attrSet('data-callout', type);

      let depth = 0;
      for (let j = i; j < tokens.length; j++) {
        if (tokens[j].type === 'blockquote_open') depth++;
        else if (tokens[j].type === 'blockquote_close') {
          depth--;
          if (depth === 0) {
            tokens[j].tag = 'div';
            break;
          }
        }
      }

      paraOpen.tag = 'div';
      paraOpen.attrSet('class', 'callout-title');
      const paraClose = tokens[i + 3];
      if (paraClose && paraClose.type === 'paragraph_close') paraClose.tag = 'div';

      inline.content = titleText;
      inline.children = [];

      if (bodyText.trim()) {
        const bodyOpen = new state.Token('paragraph_open', 'p', 1);
        const bodyInline = new state.Token('inline', '', 0);
        bodyInline.content = bodyText;
        bodyInline.children = [];
        const bodyClose = new state.Token('paragraph_close', 'p', -1);
        tokens.splice(i + 4, 0, bodyOpen, bodyInline, bodyClose);
      }
    } catch {
      // Leave as a plain blockquote.
    }
  }
}

/** Core rule to collect headings. */
function collectHeadingsRule(state: StateCore): void {
  const env = state.env as RenderEnv;
  if (!env.headings) return;
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'heading_open') continue;
    const level = Number(t.tag.slice(1)) || 1;
    const inline = tokens[i + 1];
    const text = inline && inline.type === 'inline' ? inline.content : '';
    const id = t.attrGet('id') ?? anchorSlug(text);
    env.headings.push({ level, text, slug: id });
  }
}

/** Wrap standalone images in <figure>. */
function figureImagesRule(state: StateCore): void {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'paragraph_open') continue;
    const inline = tokens[i + 1];
    const close = tokens[i + 2];
    if (!inline || inline.type !== 'inline') continue;
    if (!close || close.type !== 'paragraph_close') continue;
    const kids = (inline.children ?? []).filter((t) => !(t.type === 'text' && !t.content.trim()));
    if (kids.length !== 1 || kids[0].type !== 'image') continue;

    tokens[i].tag = 'figure';
    tokens[i].attrSet('class', 'md-figure');
    close.tag = 'figure';
    const caption = kids[0].attrGet('title');
    if (caption) {
      const cap = new state.Token('html_block', '', 0);
      cap.content = `<figcaption>${escapeHtml(caption)}</figcaption>\n`;
      tokens.splice(i + 2, 0, cap);
    }
  }
}

export interface MarkdownOptions {
  /** Synchronous code highlighter (from createCodeHighlighter). */
  highlight?: HighlightFn;
  /** Plugins whose `markdown` hook extends the instance. */
  plugins?: MdsitePlugin[];
}

/** Create markdown-it parser. */
export function createMarkdown(config: MdsiteConfig, options: MarkdownOptions = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
    highlight: options.highlight,
  });

  md.use(footnote);
  md.use(taskLists, { label: true, labelAfter: true });
  md.use(anchor, { slugify: anchorSlug, tabIndex: false });
  if (config.features.math) {
    md.use(katex, { throwOnError: false });
  }

  md.inline.ruler.before('link', 'wikilink', wikilinkRule);
  md.core.ruler.after('block', 'callouts', calloutsRule);
  md.core.ruler.push('collect_headings', collectHeadingsRule);
  md.core.ruler.push('figure_images', figureImagesRule);

  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, opts2, env, self) => {
    const token = tokens[idx];
    if (!token.attrGet('loading')) token.attrSet('loading', 'lazy');
    if (!token.attrGet('decoding')) token.attrSet('decoding', 'async');
    return defaultImage
      ? defaultImage(tokens, idx, opts2, env, self)
      : self.renderToken(tokens, idx, opts2);
  };

  if (config.features.mermaid) {
    const defaultFence = md.renderer.rules.fence;
    md.renderer.rules.fence = (tokens, idx, opts2, env, self) => {
      const info = tokens[idx].info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      if (info === 'mermaid') {
        return `<pre class="mermaid">${escapeHtml(tokens[idx].content)}</pre>\n`;
      }
      return defaultFence
        ? defaultFence(tokens, idx, opts2, env, self)
        : self.renderToken(tokens, idx, opts2);
    };
  }

  for (const plugin of options.plugins ?? []) plugin.markdown?.(md, config);

  return md;
}
