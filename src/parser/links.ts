import GithubSlugger, { slug as slugAnchor } from 'github-slugger';
import type {
  Asset,
  EmbedResolution,
  LinkResolution,
  Page,
  RenderEnv,
} from '../types.js';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp', 'ico']);

// NOTE: basePath is a module-level singleton. This is intentional for the
// single-threaded CLI use-case. If build() is called concurrently (e.g. in
// programmatic use or parallel tests), callers must ensure setBasePath() is
// not racing. Passing basePath as a parameter through the render pipeline
// would be the proper fix, but the scope of that change is large.
let basePath = '';

/** Set site base path. */
export function setBasePath(bp: string | undefined): void {
  let p = (bp ?? '').trim();
  if (!p || p === '/') {
    basePath = '';
    return;
  }
  if (!p.startsWith('/')) p = `/${p}`;
  basePath = p.replace(/\/+$/, '');
}

export function getBasePath(): string {
  return basePath;
}

/** Prefix URL with base path. */
export function withBase(url: string): string {
  if (!basePath) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url; // hash, relative, protocol-relative, or absolute
  return `${basePath}${url}`;
}

/** Slugify single segment. */
export function slugifySegment(segment: string): string {
  return segment
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

/** Convert path to a URL slug. */
export function slugifyPath(relPath: string): string {
  const noExt = relPath.replace(/\.md$/i, '');
  const segments = noExt.split('/').map(slugifySegment).filter(Boolean);
  if (segments.length && segments[segments.length - 1] === 'index') segments.pop();
  return segments.join('/');
}

/** Slugify asset path. */
export function slugifyAssetPath(relPath: string): string {
  const segments = relPath.split('/');
  const file = segments.pop() ?? '';
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot + 1).toLowerCase() : '';
  const slugged = [...segments.map(slugifySegment), slugifySegment(base)].filter(Boolean);
  const tail = slugged.join('/');
  return ext ? `${tail}.${ext}` : tail;
}

export function urlForSlug(slug: string): string {
  return withBase(slug ? `/${slug}/` : '/');
}

/** URL-safe slug for a tag (shared by tag pages and meta chips). */
export function tagSlug(tag: string): string {
  return slugifySegment(tag);
}

export function tagUrl(tag: string): string {
  return withBase(`/tags/${slugifySegment(tag)}/`);
}

export function outPathForSlug(slug: string): string {
  return slug ? `${slug}/index.html` : 'index.html';
}

export function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

/** Generate heading anchor slug. */
export function anchorSlug(text: string): string {
  return slugAnchor(text);
}

/** Index for looking up pages and assets. */
export interface SiteIndex {
  pages: Map<string, Page>; // slug -> page
  pagesByName: Map<string, string>; // lowercased basename -> slug
  pagesByPath: Map<string, string>; // normalized relative path -> slug
  assetsByName: Map<string, string>; // lowercased basename -> url
  assetsByPath: Map<string, string>; // normalized relative path -> url
  assetDims: Map<string, { width: number; height: number }>; // asset url -> intrinsic size
}

export function buildSiteIndex(pages: Page[], assets: Asset[]): SiteIndex {
  const index: SiteIndex = {
    pages: new Map(),
    pagesByName: new Map(),
    pagesByPath: new Map(),
    assetsByName: new Map(),
    assetsByPath: new Map(),
    assetDims: new Map(),
  };

  for (const page of pages) {
    index.pages.set(page.slug, page);
    if (!index.pagesByPath.has(page.slug)) index.pagesByPath.set(page.slug, page.slug);
    const name = basename(page.slug);
    if (name && !index.pagesByName.has(name)) index.pagesByName.set(name, page.slug);

    for (const alias of page.aliases) {
      const aliasSlug = slugifyPath(alias);
      if (aliasSlug && !index.pagesByPath.has(aliasSlug)) index.pagesByPath.set(aliasSlug, page.slug);
      const aliasName = basename(aliasSlug);
      if (aliasName && !index.pagesByName.has(aliasName)) index.pagesByName.set(aliasName, page.slug);
    }
  }

  for (const asset of assets) {
    const key = asset.outPath.toLowerCase();
    if (!index.assetsByPath.has(key)) index.assetsByPath.set(key, asset.url);
    const name = basename(key);
    if (name && !index.assetsByName.has(name)) index.assetsByName.set(name, asset.url);
    if (asset.width && asset.height) {
      index.assetDims.set(asset.url, { width: asset.width, height: asset.height });
    }
  }

  return index;
}

function lookupPageSlug(index: SiteIndex, target: string): string | undefined {
  const key = slugifyPath(target);
  if (index.pagesByPath.has(key)) return index.pagesByPath.get(key);
  return index.pagesByName.get(basename(key));
}

function lookupAssetUrl(index: SiteIndex, target: string): string | undefined {
  const cleaned = target.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
  const key = slugifyAssetPath(cleaned);
  if (index.assetsByPath.has(key)) return index.assetsByPath.get(key);
  return index.assetsByName.get(basename(key));
}

/** Create rendering environment. */
export function makeRenderEnv(index: SiteIndex): RenderEnv {
  const outgoing = new Set<string>();

  const resolveLink = (target: string, anchor: string): LinkResolution => {
    if (!target.trim() && anchor) {
      return { url: `#${anchorSlug(anchor)}`, resolved: true };
    }
    const slug = lookupPageSlug(index, target);
    const hash = anchor ? `#${anchorSlug(anchor)}` : '';
    if (slug === undefined) {
      return { url: `${hash || '#'}`, resolved: false };
    }
    outgoing.add(slug);
    return { url: `${urlForSlug(slug)}${hash}`, resolved: true };
  };

  const resolveEmbed = (target: string, alias: string): EmbedResolution => {
    const ext = target.split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_EXTS.has(ext)) {
      const src = lookupAssetUrl(index, target) ?? '';
      const alt = alias || basename(target).replace(/\.[^.]+$/, '');
      const dims = index.assetDims.get(src);
      return { kind: 'image', src, alt, width: dims?.width, height: dims?.height };
    }
    const slug = lookupPageSlug(index, target);
    if (slug === undefined) {
      return { kind: 'note', url: '#', title: alias || target, resolved: false };
    }
    outgoing.add(slug);
    return { kind: 'note', url: urlForSlug(slug), title: alias || basename(target), resolved: true };
  };

  return { resolveLink, resolveEmbed, outgoing, headings: [] };
}

export { GithubSlugger };
