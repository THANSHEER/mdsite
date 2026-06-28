import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import picomatch from 'picomatch';
import { imageSize } from 'image-size';
import {
  outPathForSlug,
  slugifyAssetPath,
  slugifyPath,
  slugifySegment,
  urlForSlug,
  withBase,
} from './links.js';
import type { Asset, MdsiteConfig, Page } from '../types.js';

// Files copied verbatim into the output site (not processed as Markdown).
const ASSET_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp', 'ico',
  'pdf', 'mp4', 'webm', 'mov', 'mp3', 'ogg', 'wav',
  'woff', 'woff2', 'ttf', 'otf',
]);

// Subset of ASSET_EXTS for which we read pixel dimensions (used to emit width/height attrs).
const IMAGE_DIM_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg']);

export interface CollectResult {
  pages: Page[];
  assets: Asset[];
}

/**
 * Parse a gitignore-style file: strip comments and blank lines,
 * return the remaining pattern strings.
 */
function parseIgnoreFile(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Load ignore patterns from `.mdgardenignore` then `.gitignore` in
 * the given directory. Missing files are silently skipped.
 */
export async function loadIgnorePatterns(projectRoot: string): Promise<string[]> {
  const patterns: string[] = [];
  for (const filename of ['.mdgardenignore', '.gitignore']) {
    try {
      const raw = await fs.readFile(path.join(projectRoot, filename), 'utf8');
      patterns.push(...parseIgnoreFile(raw));
    } catch {
      // File not present or unreadable — skip silently.
    }
  }
  return patterns;
}

/** Collect pages and assets from contentDir using the provided ignore patterns. */
export async function collectContent(
  contentDir: string,
  config: MdsiteConfig,
  ignorePatterns: string[],
): Promise<CollectResult> {
  const matcher = ignorePatterns.length
    ? picomatch(ignorePatterns, { dot: true })
    : () => false;
  const isIgnored = (rel: string): boolean => matcher(rel);

  const files = await walk(contentDir, contentDir, isIgnored);
  const pages: Page[] = [];
  const assets: Asset[] = [];

  for (const rel of files) {
    const ext = rel.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'md') {
      const page = await readPage(contentDir, rel, config);
      if (page) pages.push(page);
    } else if (ASSET_EXTS.has(ext)) {
      const outPath = slugifyAssetPath(rel);
      const asset: Asset = { sourcePath: rel, outPath, url: withBase(`/${outPath}`) };
      if (IMAGE_DIM_EXTS.has(ext)) {
        try {
          const { width, height } = imageSize(await fs.readFile(path.join(contentDir, rel)));
          if (width && height) {
            asset.width = width;
            asset.height = height;
          }
        } catch {}
      }
      assets.push(asset);
    }
  }

  return { pages, assets };
}

async function walk(root: string, dir: string, isIgnored: (rel: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (isIgnored(rel)) continue;
    if (entry.isDirectory()) {
      out.push(...(await walk(root, abs, isIgnored)));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

async function readPage(contentDir: string, rel: string, config: MdsiteConfig): Promise<Page | null> {
  const raw = await fs.readFile(path.join(contentDir, rel), 'utf8');

  let data: Record<string, unknown> = {};
  let body = raw;
  try {
    const parsed = matter(raw);
    data = parsed.data as Record<string, unknown>;
    body = parsed.content;
  } catch {
    // Fallback for malformed frontmatter.
    data = {};
    body = raw;
  }

  const isDraft = data.draft === true || data.private === true || data.publish === false;
  if (isDraft) return null;

  const isLanding = rel === config.build.landingPage;
  const slug = resolveSlug(data, rel, isLanding);
  const title = pickTitle(data.title, body, rel);
  const words = countWords(body);
  const aliases = normalizeAliases(data.aliases);
  
  if (isLanding && slug === '') {
    // Add original path as alias.
    const originalSlug = slugifyPath(rel);
    if (originalSlug && !aliases.includes(originalSlug)) {
      aliases.push(originalSlug);
    }
  }

  let pageDate = normalizeDate(data.date);
  let mtimeMs = 0;
  
  if (!pageDate) {
    try {
      const absPath = path.join(contentDir, rel);
      const stdout = execSync(`git log -1 --format="%at" -- "${absPath}"`, { stdio: 'pipe', encoding: 'utf8' }).trim();
      const stat = await fs.stat(absPath);
      mtimeMs = stat.mtimeMs;
      
      if (stdout) {
        pageDate = new Date(parseInt(stdout, 10) * 1000).toISOString().split('T')[0];
      } else {
        pageDate = new Date(stat.mtimeMs).toISOString().split('T')[0];
      }
    } catch {
      try {
        const absPath = path.join(contentDir, rel);
        const stat = await fs.stat(absPath);
        mtimeMs = stat.mtimeMs;
        pageDate = new Date(stat.mtimeMs).toISOString().split('T')[0];
      } catch {}
    }
  } else {
    try {
        const absPath = path.join(contentDir, rel);
        const stat = await fs.stat(absPath);
        mtimeMs = stat.mtimeMs;
    } catch {}
  }

  return {
    sourcePath: rel,
    slug,
    outPath: outPathForSlug(slug),
    url: urlForSlug(slug),
    title,
    description: typeof data.description === 'string' ? data.description : '',
    frontmatter: data,
    body,
    tags: normalizeTags(data.tags),
    date: pageDate,
    draft: false,
    lang: typeof data.lang === 'string' && data.lang.trim() ? data.lang.trim() : undefined,
    aliases,
    words,
    readingTime: Math.max(1, Math.round(words / 200)),
    links: [],
    backlinks: [],
    html: '',
    headings: [],
    mtimeMs,
  };
}

/** Count words in content. */
function countWords(body: string): number {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[#>*_~[\]()!|-]+/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}

/** Normalize aliases to string array. */
function normalizeAliases(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

/** Resolve page slug. */
function resolveSlug(data: Record<string, unknown>, rel: string, isLanding: boolean): string {
  if (isLanding) return '';
  const override =
    (typeof data.permalink === 'string' && data.permalink) ||
    (typeof data.slug === 'string' && data.slug) ||
    '';
  if (override) {
    const segs = override.split('/').map(slugifySegment).filter(Boolean);
    if (segs.length && segs[segs.length - 1] === 'index') segs.pop();
    return segs.join('/');
  }
  const baseSlug = slugifyPath(rel);
  if (!isLanding && baseSlug === '') {
    return 'index';
  }
  return baseSlug;
}

function pickTitle(fmTitle: unknown, body: string, rel: string): string {
  if (typeof fmTitle === 'string' && fmTitle.trim()) return fmTitle.trim();
  const heading = /^#\s+(.+)$/m.exec(body);
  if (heading) return heading[1].trim();
  const base = rel.split('/').pop() ?? rel;
  return base.replace(/\.md$/i, '');
}

function normalizeTags(value: unknown): string[] {
  const clean = (t: string): string => t.trim().replace(/^#/, '');
  if (Array.isArray(value)) return value.map((t) => clean(String(t))).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,\s]+/).map(clean).filter(Boolean);
  return [];
}

function normalizeDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}
