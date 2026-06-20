// Built-in plugins: Open Graph/Twitter cards, and Giscus comments.

import { withBase } from './parser/links.js';
import { escapeAttr } from './utils.js';
import type { MdsitePlugin, RenderInfo } from './core/plugin.js';
import type { MdsiteConfig } from './types.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** The built-in plugins enabled for a given config. */
export function builtinPlugins(config: MdsiteConfig): MdsitePlugin[] {
  const plugins: MdsitePlugin[] = [ogPlugin()];
  if (config.features.comments && config.comments) plugins.push(commentsPlugin());
  return plugins;
}

// ---------------------------------------------------------------------------
// OG / Twitter Card plugin
// ---------------------------------------------------------------------------

/** Make a URL absolute against `site.baseUrl` (left relative if no baseUrl). */
function absoluteUrl(config: MdsiteConfig, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = config.site.baseUrl.replace(/\/$/, '');
  return base ? `${base}${url}` : url;
}

/** Resolve the social image for a document (frontmatter → site default). */
function ogImage(info: RenderInfo, config: MdsiteConfig): string | undefined {
  const fm = info.frontmatter ?? {};
  const raw =
    (typeof fm.image === 'string' && fm.image) ||
    (typeof fm.cover === 'string' && fm.cover) ||
    config.site.image ||
    '';
  if (!raw) return undefined;
  const rooted = raw.startsWith('/') ? withBase(raw) : raw;
  return absoluteUrl(config, rooted);
}

function ogPlugin(): MdsitePlugin {
  return {
    name: 'og',
    head(info: RenderInfo, config: MdsiteConfig) {
      const title = info.title;
      const desc = info.description;
      const url = absoluteUrl(config, info.url);
      const img = ogImage(info, config);
      const tags = [
        `<link rel="canonical" href="${escapeAttr(url)}">`,
        `<meta property="og:title" content="${escapeAttr(title)}">`,
        `<meta property="og:description" content="${escapeAttr(desc)}">`,
        `<meta property="og:type" content="${info.kind === 'note' ? 'article' : 'website'}">`,
        `<meta property="og:url" content="${escapeAttr(url)}">`,
        `<meta property="og:site_name" content="${escapeAttr(config.site.title)}">`,
        `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
        `<meta name="twitter:title" content="${escapeAttr(title)}">`,
        `<meta name="twitter:description" content="${escapeAttr(desc)}">`,
      ];
      if (img) {
        tags.push(`<meta property="og:image" content="${escapeAttr(img)}">`);
        tags.push(`<meta name="twitter:image" content="${escapeAttr(img)}">`);
      }
      return `\n${tags.join('\n')}`;
    },
  };
}

// ---------------------------------------------------------------------------
// Giscus comments plugin
// ---------------------------------------------------------------------------

function commentsPlugin(): MdsitePlugin {
  return {
    name: 'comments',
    bodyEnd(info: RenderInfo, config: MdsiteConfig) {
      const c = config.comments;
      if (!c || c.provider !== 'giscus') return '';
      if (info.kind !== 'note') return ''; // comments only on real notes
      const attrs: Record<string, string> = {
        'data-repo': c.repo,
        'data-repo-id': c.repoId,
        'data-category': c.category,
        'data-category-id': c.categoryId,
        'data-mapping': c.mapping || 'pathname',
        'data-strict': '0',
        'data-reactions-enabled': '1',
        'data-emit-metadata': '0',
        'data-input-position': 'bottom',
        'data-theme': c.theme || 'preferred_color_scheme',
        'data-lang': config.site.language || 'en',
      };
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
        .join(' ');
      return (
        `\n<section class="comments"><script src="https://giscus.app/client.js" ${attrStr} ` +
        `crossorigin="anonymous" async></script></section>`
      );
    },
  };
}
