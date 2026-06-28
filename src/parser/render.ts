import type MarkdownIt from 'markdown-it';
import { getBasePath, makeRenderEnv, tagUrl, withBase, type SiteIndex } from './links.js';
import { escapeAttr, escapeHtml, humanizeSlug, stripHtml, t } from '../utils.js';
import { collectHtml, type MdsitePlugin, type PageKind, type RenderInfo } from '../core/plugin.js';
import { buildTree, type TreeNode } from '../features/explorer.js';
import { VERSION } from '../version.js';
import type { Heading, MdsiteConfig, Page } from '../types.js';

export interface RenderContext {
  config: MdsiteConfig;
  /** All published pages, used for the left "notes" sidebar. */
  pages: Page[];
  cssHref: string;
  clientJsHref: string;
  /** Set when math is enabled (KaTeX stylesheet). */
  mathCssHref?: string;
  /** Set in Phase B when a search index is emitted. */
  searchIndexHref?: string;
  /** Plugins whose head/bodyEnd hooks contribute to every document. */
  plugins: MdsitePlugin[];
}

export interface DocumentOptions {
  title: string;
  description: string;
  /** Inner HTML of the article (already rendered). */
  bodyHtml: string;
  /** Current page URL, for active-state highlighting. */
  url: string;
  /** Page slug (no base, '/'-separated) — drives breadcrumbs. */
  slug?: string;
  headings?: Heading[];
  showMeta?: boolean;
  date?: string;
  tags?: string[];
  /** Estimated reading time in minutes (shown when features.readingTime). */
  readingTime?: number;
  /** Per-page language for <html lang> (frontmatter `lang`). */
  lang?: string;
  backlinks?: Page[];
  /** When true the caller supplies its own <h1> inside bodyHtml. */
  hideTitle?: boolean;
  /** Document kind, for plugins (defaults to "note"). */
  kind?: PageKind;
  /** Source frontmatter for real notes (plugins read e.g. an OG image). */
  frontmatter?: Record<string, unknown>;
}

/** Render markdown page body. */
export function renderBody(md: MarkdownIt, page: Page, index: SiteIndex): void {
  const env = makeRenderEnv(index);
  page.html = md.render(page.body, env);
  page.headings = env.headings;
  page.links = [...env.outgoing];
  if (!page.description) {
    page.description = stripHtml(page.html).slice(0, 180).trim();
  }
}

/** Render full HTML document. */
export function renderDocument(opts: DocumentOptions, ctx: RenderContext): string {
  const { config } = ctx;
  const siteTitle = config.site.title;
  const fullTitle = opts.title && opts.title !== siteTitle
    ? `${opts.title} — ${siteTitle}`
    : siteTitle;
  const lang = opts.lang || config.site.language || 'en';
  const description = opts.description || config.site.description;

  const info: RenderInfo = {
    kind: opts.kind ?? 'note',
    url: opts.url,
    title: opts.title || siteTitle,
    description,
    frontmatter: opts.frontmatter,
  };
  const pluginHead = collectHtml(ctx.plugins, 'head', info, config);
  const pluginBodyEnd = collectHtml(ctx.plugins, 'bodyEnd', info, config);

  // The home/landing page shows the full graph; note pages get a local/global toggle.
  const isHome = (opts.slug ?? '') === '' || opts.kind === 'home';
  const tocHtml = renderToc(opts.headings ?? []);
  const tocSection = tocHtml ? `<h2>${escapeHtml(t('onThisPage', config))}</h2>${tocHtml}` : '';
  const graphToggle = !isHome
    ? `<div class="graph-toggle" role="group" aria-label="${escapeAttr(t('graph', config))}">` +
      `<button type="button" class="graph-toggle-btn is-active" data-graph-mode="local" aria-pressed="true">${escapeHtml(t('graphLocal', config))}</button>` +
      `<button type="button" class="graph-toggle-btn" data-graph-mode="global" aria-pressed="false">${escapeHtml(t('graphGlobal', config))}</button>` +
      `</div>`
    : '';
  const graphPanel = config.features.graph
    ? `<section class="graph-panel"><h2>${escapeHtml(t('graph', config))}</h2>${graphToggle}<div class="graph" data-graph><canvas></canvas></div></section>`
    : '';
  const backlinksHtml = renderBacklinks(opts.backlinks ?? [], config);
  const rightInner = `${tocSection}${graphPanel}${backlinksHtml}`;
  const rightSidebar = rightInner
    ? `<aside class="sidebar sidebar-right">${rightInner}</aside>`
    : '';

  return `<!doctype html>
<html lang="${escapeAttr(lang)}" data-base="${escapeAttr(getBasePath())}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeAttr(description)}">
<meta name="generator" content="mdgarden ${escapeAttr(VERSION)}">
<link rel="stylesheet" href="${escapeAttr(ctx.cssHref)}">
${ctx.mathCssHref ? `<link rel="stylesheet" href="${escapeAttr(ctx.mathCssHref)}">` : ''}

${noFlashScript(config)}${pluginHead}
</head>
<body>
${renderMobileBar(ctx)}
<div class="layout${rightSidebar ? '' : ' no-right'}">
<aside class="sidebar sidebar-left">
${renderSidebarHeader(ctx)}
${renderSidebarProfile(config)}
<h2>${escapeHtml(t('notes', config))}</h2>
${renderPageList(ctx, opts.url)}
</aside>
<main class="content">
${renderBreadcrumbs(opts, config)}
${opts.hideTitle ? '' : `<h1 class="page-title">${escapeHtml(opts.title)}</h1>`}
${opts.showMeta ? renderMeta(opts, config) : ''}
${opts.bodyHtml}${pluginBodyEnd}
</main>
${rightSidebar}
</div>
${renderFooter(config)}
<a class="powered-by-mdgarden" href="https://github.com/THANSHEER/mdsite" title="Built with mdgarden">${escapeHtml(t('builtWith', config))} mdgarden</a>
<script src="${escapeAttr(ctx.clientJsHref)}" defer></script>
</body>
</html>`;
}

function noFlashScript(config: MdsiteConfig): string {
  if (config.theme.darkMode !== 'toggle' && config.theme.darkMode !== 'auto') return '';
  return `<script>(function(){try{var t=localStorage.getItem('mdgarden-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}})();</script>`;
}

/** Render left sidebar header. */
function renderSidebarHeader(ctx: RenderContext): string {
  const { config } = ctx;
  const nav = config.nav.length
    ? `<nav class="sidebar-nav">${config.nav
        .map((n) => `<a class="nav-link" href="${escapeAttr(withBase(n.url))}">${escapeHtml(n.title)}</a>`)
        .join('')}</nav>`
    : '';

  const toggleLabel = escapeAttr(t('toggleDark', config));
  const toggle = config.theme.darkMode === 'toggle'
    ? `<button class="icon-button icon-button-sm" data-theme-toggle aria-label="${toggleLabel}" title="${toggleLabel}">◐</button>`
    : '';

  const searchLabel = escapeAttr(t('search', config));
  const searchIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  const search = ctx.searchIndexHref
    ? `<button class="search-trigger" data-search-open data-placeholder="${escapeAttr(t('searchPlaceholder', config))}" aria-label="${searchLabel}">${searchIcon}<span class="search-trigger-label">${escapeHtml(t('searchPlaceholder', config))}</span></button>`
    : '';

  return `<div class="sidebar-header">
${renderSidebarLogo(config)}
<div class="sidebar-header-top">
<a class="site-title" href="${escapeAttr(withBase('/'))}">${escapeHtml(config.site.title)}</a>
${toggle}
</div>
${nav}
${search}
</div>`;
}

/** Render the optional sidebar logo (emoji/text badge or image), linking home. */
function renderSidebarLogo(config: MdsiteConfig): string {
  const logo = config.site.logo?.trim();
  if (!logo) return '';
  const href = escapeAttr(withBase('/'));
  const alt = escapeAttr(config.site.title);
  const isUrl = /^https?:\/\//i.test(logo);
  const isImage = isUrl || /\.(png|jpe?g|svg|webp|gif|avif)$/i.test(logo);
  if (isImage) {
    const src = isUrl ? logo : withBase(logo.startsWith('/') ? logo : `/${logo}`);
    return `<a class="sidebar-logo" href="${href}" aria-label="${alt}"><img class="sidebar-logo-img" src="${escapeAttr(src)}" alt="${alt}"></a>`;
  }
  return `<a class="sidebar-logo sidebar-logo-emoji" href="${href}" aria-label="${alt}">${escapeHtml(logo)}</a>`;
}

/** Render mobile bar header. */
function renderMobileBar(ctx: RenderContext): string {
  const { config } = ctx;
  const menuLabel = escapeAttr(t('menu', config));
  return `<div class="mobile-bar">
<a class="site-title" href="${escapeAttr(withBase('/'))}">${escapeHtml(config.site.title)}</a>
<button class="icon-button" data-sidebar-toggle aria-label="${menuLabel}" title="${menuLabel}">☰</button>
</div>
<div class="sidebar-backdrop" data-sidebar-backdrop></div>`;
}

/** Render profile section. */
function renderSidebarProfile(config: MdsiteConfig): string {
  const { author, description } = config.site;
  if (!author && !description) return '';
  const name = author ? `<div class="sidebar-profile-name">${escapeHtml(author)}</div>` : '';
  const bio = description ? `<p class="sidebar-profile-bio">${escapeHtml(description)}</p>` : '';
  return `<div class="sidebar-profile">${name}${bio}</div>`;
}

function renderPageList(ctx: RenderContext, currentUrl: string): string {
  if (ctx.config.features.explorer) {
    return `<ul class="explorer-list">${renderTree(buildTree(ctx.pages), currentUrl)}</ul>`;
  }
  const items = [...ctx.pages]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => {
      const active = p.url === currentUrl ? ' class="is-active"' : '';
      return `<li><a href="${escapeAttr(p.url)}"${active}>${escapeHtml(p.title)}</a></li>`;
    })
    .join('');
  return `<ul class="page-list">${items}</ul>`;
}

/** Render folder tree. */
function renderTree(nodes: TreeNode[], currentUrl: string): string {
  return nodes
    .map((n) => {
      if (n.isFolder) {
        const open = currentUrl.startsWith(n.url);
        const label = n.page
          ? `<a class="folder-label" href="${escapeAttr(n.page.url)}">${escapeHtml(n.name)}</a>`
          : `<span class="folder-label">${escapeHtml(n.name)}</span>`;
        return `<li class="explorer-folder${open ? ' is-open' : ''}">` +
          `<button class="folder-toggle" aria-expanded="${open}" aria-label="Toggle folder"></button>` +
          `${label}<ul class="explorer-children">${renderTree(n.children, currentUrl)}</ul></li>`;
      }
      const active = n.page && n.page.url === currentUrl ? ' class="is-active"' : '';
      const href = n.page ? n.page.url : n.url;
      return `<li class="explorer-file"><a href="${escapeAttr(href)}"${active}>${escapeHtml(n.name)}</a></li>`;
    })
    .join('');
}

function renderToc(headings: Heading[]): string {
  const items = headings.filter((h) => h.level === 2 || h.level === 3);
  if (items.length === 0) return '';
  const lis = items
    .map(
      (h) =>
        `<li><a class="toc-h${h.level}" href="#${escapeAttr(h.slug)}">${escapeHtml(h.text)}</a></li>`,
    )
    .join('');
  return `<ul class="toc-list">${lis}</ul>`;
}

/** Render breadcrumb trail. */
function renderBreadcrumbs(opts: DocumentOptions, config: MdsiteConfig): string {
  if (!config.features.breadcrumbs) return '';
  const slug = opts.slug ?? '';
  if (!slug || !slug.includes('/')) return ''; // only show on nested pages
  const segs = slug.split('/');
  const sep = '<span class="crumb-sep">/</span>';
  const crumbs = [
    `<a href="${escapeAttr(withBase('/'))}">${escapeHtml(t('home', config))}</a>`,
  ];
  let acc = '';
  for (let i = 0; i < segs.length - 1; i++) {
    acc += `/${segs[i]}`;
    crumbs.push(
      `<a href="${escapeAttr(withBase(`${acc}/`))}">${escapeHtml(humanizeSlug(segs[i]))}</a>`,
    );
  }
  crumbs.push(`<span aria-current="page">${escapeHtml(opts.title)}</span>`);
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${crumbs.join(sep)}</nav>`;
}

function renderMeta(opts: DocumentOptions, config: MdsiteConfig): string {
  const parts: string[] = [];
  if (opts.date) {
    const d = formatDate(opts.date, config);
    if (d) parts.push(`<time datetime="${escapeAttr(opts.date)}">${escapeHtml(d)}</time>`);
  }
  if (config.features.readingTime && opts.readingTime) {
    parts.push(`<span class="reading-time">${opts.readingTime} ${escapeHtml(t('minRead', config))}</span>`);
  }
  for (const tag of opts.tags ?? []) {
    parts.push(`<a class="tag" href="${escapeAttr(tagUrl(tag))}">#${escapeHtml(tag)}</a>`);
  }
  if (parts.length === 0) return '';
  return `<div class="page-meta">${parts.join('')}</div>`;
}

function renderBacklinks(backlinks: Page[], config: MdsiteConfig): string {
  if (backlinks.length === 0) return '';
  const items = backlinks
    .map(
      (p) =>
        `<li class="backlink-item"><a href="${escapeAttr(p.url)}">${escapeHtml(p.title)}</a></li>`,
    )
    .join('');
  return `<section class="backlinks"><h2>${escapeHtml(t('linkedReferences', config))}</h2><ul class="backlink-list">${items}</ul></section>`;
}

function renderFooter(config: MdsiteConfig): string {
  const { footer } = config;
  const links = footer.links
    ? Object.entries(footer.links)
        .map(([label, url]) => `<a href="${escapeAttr(withBase(url))}">${escapeHtml(label)}</a>`)
        .join('')
    : '';
  const text = footer.text ? escapeHtml(footer.text) : '';
  if (!text && !links) {
    return '';
  }
  return `<footer class="site-footer">${text}${links ? `<div>${links}</div>` : ''}</footer>`;
}

function formatDate(value: string, config: MdsiteConfig): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const locale = config.site.locale || config.site.language || 'en';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}
