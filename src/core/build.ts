import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { collectContent, loadIgnorePatterns } from '../parser/content.js';
import { buildSiteIndex, outPathForSlug, setBasePath, slugifyPath, tagSlug, withBase } from '../parser/links.js';
import { buildTree, listFolders } from '../features/explorer.js';
import { escapeAttr, escapeHtml } from '../utils.js';
import { createMarkdown } from '../parser/markdown.js';
import { collectCodeLangs, createCodeHighlighter, type HighlightFn } from '../parser/highlight.js';
import { renderBody, renderDocument, type RenderContext } from '../parser/render.js';
import { renderHomePage, renderNotFoundPage, buildTagMap, renderTagIndex, renderTagPage } from '../pages/generated.js';
import { buildSearchIndex, buildGraph } from '../features/data.js';
import { buildSitemap, buildRss, buildRobots } from '../features/feeds.js';
import { buildStyles } from '../parser/theme.js';
import { copyAsset, ensureCleanDir, writeOut } from './emit.js';
import { getClientRuntime, getMermaidRuntime, getKatexCss, writeKatexFonts } from '../parser/assets.js';
import { builtinPlugins } from '../plugins.js';
import type { MdsitePlugin, PluginContext } from './plugin.js';
import type { Page } from '../types.js';

export interface BuildOptions {
  cwd?: string;
  /** Override config.build.contentDir. */
  contentDir?: string;
  /** Override config.build.outDir. */
  outDir?: string;
  /** Explicit path to mdgarden.config.json. */
  configPath?: string;
  /** Extra plugins, appended after the built-ins (programmatic use). */
  plugins?: MdsitePlugin[];
}

export interface BuildResult {
  pageCount: number;
  assetCount: number;
  outDir: string;
}

/** Build static site from markdown files. */
export async function build(opts: BuildOptions = {}): Promise<BuildResult> {
  const cwd = opts.cwd ?? process.cwd();
  const { config, baseDir } = await loadConfig(opts.configPath, cwd);

  setBasePath(config.build.basePath);

  const contentDir = opts.contentDir
    ? path.resolve(cwd, opts.contentDir)
    : path.resolve(baseDir, config.build.contentDir);
  const outDir = opts.outDir
    ? path.resolve(cwd, opts.outDir)
    : path.resolve(baseDir, config.build.outDir);

  const { pages, assets } = await (async () => {
    // Deprecation: old configs may still have build.ignore — warn and ignore it.
    const legacyIgnore = (config.build as unknown as Record<string, unknown>).ignore;
    if (Array.isArray(legacyIgnore) && legacyIgnore.length > 0) {
      console.warn(
        '\n⚠  build.ignore in mdgarden.config.json is no longer supported.\n' +
        '   Move your patterns to .mdgardenignore instead.\n' +
        '   See: https://github.com/THANSHEER/mdsite#mdgardenignore\n',
      );
    }
    const ignorePatterns = await loadIgnorePatterns(baseDir);
    return collectContent(contentDir, config, ignorePatterns);
  })();
  const index = buildSiteIndex(pages, assets);

  const plugins: MdsitePlugin[] = [...builtinPlugins(config), ...(opts.plugins ?? [])];
  const pluginCtx: PluginContext = { config, pages, outDir };

  let highlight: HighlightFn | undefined;
  if (config.features.syntaxHighlight) {
    try {
      // Load exactly the languages used in the content — supports any of shiki's
      // bundled grammars without a hardcoded allow-list.
      highlight = await createCodeHighlighter(collectCodeLangs(pages.map((p) => p.body)));
    } catch {
      highlight = undefined;
    }
  }
  const md = createMarkdown(config, { highlight, plugins });

  for (const page of pages) renderBody(md, page, index);

  if (config.features.backlinks) computeBacklinks(pages, index);

  for (const page of pages) {
    for (const plugin of plugins) await plugin.page?.(page, pluginCtx);
  }

  let customCss = '';
  if (config.theme.customCss) {
    try {
      customCss = await fs.readFile(path.resolve(baseDir, config.theme.customCss), 'utf8');
    } catch {}
  }

  const ctx: RenderContext = {
    config,
    pages,
    cssHref: withBase('/styles.css'),
    clientJsHref: withBase('/mdgarden.client.js'),
    mathCssHref: config.features.math ? withBase('/katex/katex.min.css') : undefined,
    searchIndexHref: config.features.search ? withBase('/search-index.json') : undefined,
    plugins,
  };

  await ensureCleanDir(outDir);

  for (const page of pages) {
    const backlinks = page.backlinks
      .map((slug) => index.pages.get(slug))
      .filter((p): p is Page => p !== undefined);

    const html = renderDocument(
      {
        title: page.title,
        description: page.description,
        bodyHtml: page.html,
        url: page.url,
        slug: page.slug,
        headings: page.headings,
        showMeta: true,
        date: page.date,
        tags: page.tags,
        backlinks,
        kind: 'note',
        frontmatter: page.frontmatter,
        readingTime: page.readingTime,
        lang: page.lang,
      },
      ctx,
    );
    await writeOut(outDir, page.outPath, html);
  }

  if (!pages.some((p) => p.slug === '')) {
    await writeOut(outDir, 'index.html', renderHomePage(ctx));
  }

  if (config.build.folderIndex) {
    for (const folder of listFolders(buildTree(pages))) {
      if (folder.page) continue;
      const items = folder.children
        .map((c) => {
          const href = c.page ? c.page.url : c.url;
          const label = c.isFolder ? `${escapeHtml(c.name)}/` : escapeHtml(c.name);
          return `<li><a href="${escapeAttr(href)}">${label}</a></li>`;
        })
        .join('');
      const body = `<ul class="page-list home-list">${items}</ul>`;
      const html = renderDocument(
        { title: folder.name, description: '', bodyHtml: body, url: folder.url, slug: folder.slug, kind: 'folder' },
        ctx,
      );
      await writeOut(outDir, outPathForSlug(folder.slug), html);
    }
  }

  await writeOut(outDir, '404.html', renderNotFoundPage(ctx));

  if (config.features.tags) {
    const tagMap = buildTagMap(pages);
    if (tagMap.size > 0) {
      await writeOut(outDir, 'tags/index.html', renderTagIndex(ctx, tagMap));
      for (const entry of tagMap.values()) {
        await writeOut(outDir, `tags/${tagSlug(entry.display)}/index.html`, renderTagPage(ctx, entry));
      }
    }
  }

  const realSlugs = new Set(pages.map((p) => p.slug));
  const writtenAliases = new Set<string>();
  for (const page of pages) {
    for (const alias of page.aliases) {
      const aliasSlug = slugifyPath(alias);
      if (!aliasSlug || realSlugs.has(aliasSlug) || writtenAliases.has(aliasSlug)) continue;
      writtenAliases.add(aliasSlug);
      await writeOut(outDir, outPathForSlug(aliasSlug), redirectHtml(page.url));
    }
  }

  if (config.features.search) {
    await writeOut(outDir, 'search-index.json', buildSearchIndex(pages));
  }

  if (config.features.graph) {
    await writeOut(outDir, 'graph.json', buildGraph(pages));
  }

  // Feeds.
  if (config.features.sitemap) {
    await writeOut(outDir, 'sitemap.xml', buildSitemap(pages, config.site.baseUrl));
    await writeOut(outDir, 'robots.txt', buildRobots(config));
  }
  if (config.features.rss) {
    await writeOut(outDir, 'rss.xml', buildRss(pages, config));
  }

  await writeOut(outDir, 'styles.css', buildStyles(config, customCss));

  const client = await getClientRuntime();
  if (client) await writeOut(outDir, 'mdgarden.client.js', client);

  if (config.features.mermaid && pages.some((p) => p.html.includes('class="mermaid"'))) {
    const mermaidJs = await getMermaidRuntime();
    if (mermaidJs) await writeOut(outDir, 'mdgarden.mermaid.js', mermaidJs);
  }

  if (config.features.math) {
    try {
      await copyKatexAssets(outDir);
    } catch {}
  }

  for (const asset of assets) {
    await copyAsset(contentDir, asset.sourcePath, outDir, asset.outPath);
  }

  for (const plugin of plugins) {
    for (const file of (await plugin.emit?.(pluginCtx)) ?? []) {
      await writeOut(outDir, file.path, file.content);
    }
  }

  return { pageCount: pages.length, assetCount: assets.length, outDir };
}

async function copyKatexAssets(outDir: string): Promise<void> {
  const katexOut = path.join(outDir, 'katex');
  await fs.mkdir(katexOut, { recursive: true });
  await fs.writeFile(path.join(katexOut, 'katex.min.css'), await getKatexCss());
  await writeKatexFonts(path.join(katexOut, 'fonts'));
}

function redirectHtml(target: string): string {
  const attr = escapeAttr(target);
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta http-equiv="refresh" content="0; url=${attr}">` +
    `<link rel="canonical" href="${attr}"><title>Redirecting…</title></head>` +
    `<body><p><a href="${attr}">Redirecting…</a></p>` +
    `<script>location.replace(${JSON.stringify(target)})</script></body></html>`
  );
}

function computeBacklinks(pages: Page[], index: ReturnType<typeof buildSiteIndex>): void {
  for (const page of pages) {
    for (const targetSlug of page.links) {
      const target = index.pages.get(targetSlug);
      if (target && target.slug !== page.slug && !target.backlinks.includes(page.slug)) {
        target.backlinks.push(page.slug);
      }
    }
  }
}
