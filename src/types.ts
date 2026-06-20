// Core data model for mdsite. Kept dependency-free so it can be imported from
// both the Node build (CLI) and any embedding host.

export interface SiteConfig {
  title: string;
  description: string;
  /** Absolute base URL of the deployed site, used for RSS/sitemap/OG (no trailing slash). */
  baseUrl: string;
  author: string;
  language: string;
  /** Sidebar logo: an emoji/short text badge, or an image path/URL. Optional. */
  logo?: string;
  /** Default social/OG image (absolute or root-relative URL). Optional. */
  image?: string;
  /** BCP-47 locale for date formatting (defaults to `language`). Optional. */
  locale?: string;
}

export interface ThemeColors {
  background: string;
  text: string;
  primary: string;
  accent: string;
  muted: string;
  border: string;
  surface: string;
}

export type DarkModeMode = 'toggle' | 'auto' | 'light' | 'dark';

export interface ThemeConfig {
  name: string;
  darkMode: DarkModeMode;
  colors: { light: ThemeColors; dark: ThemeColors };
  fonts: { heading: string; body: string; code: string };
  /** Optional path (relative to the config file) to extra CSS appended last. */
  customCss?: string;
}

export interface NavItem {
  title: string;
  url: string;
}

export interface FooterConfig {
  text?: string;
  links?: Record<string, string>;
}

export interface FeatureFlags {
  search: boolean;
  backlinks: boolean;
  tags: boolean;
  graph: boolean;
  math: boolean;
  syntaxHighlight: boolean;
  rss: boolean;
  sitemap: boolean;
  /** "N min read" estimate in page meta. */
  readingTime: boolean;
  /** Render ```mermaid fences as diagrams (lazy-loaded client chunk). */
  mermaid: boolean;
  /** Folder-tree sidebar instead of a flat note list. */
  explorer: boolean;
  /** Breadcrumb trail on nested pages. */
  breadcrumbs: boolean;
  /** Comment widget (requires `comments` config). Off by default. */
  comments: boolean;
}

export interface BuildConfig {
  contentDir: string;
  outDir: string;
  /** Sub-path the site is served under, e.g. "/notes" for GitHub Pages project sites ("" = root). */
  basePath: string;
  /** Which markdown file should be compiled as the site's root index.html (default: "index.md"). */
  landingPage: string;
  /** Auto-generate an index page for folders that lack their own index.md. */
  folderIndex: boolean;
}

/** Comment-widget configuration. Only Giscus is supported today. */
export interface CommentsConfig {
  provider: 'giscus';
  /** "owner/repo" hosting the discussions. */
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  /** giscus `data-mapping` (default "pathname"). */
  mapping?: string;
  /** giscus theme name or URL (defaults to light/dark synced). */
  theme?: string;
}

export interface MdsiteConfig {
  site: SiteConfig;
  theme: ThemeConfig;
  nav: NavItem[];
  footer: FooterConfig;
  features: FeatureFlags;
  build: BuildConfig;
  /** Comment-widget settings (when `features.comments`). Optional. */
  comments?: CommentsConfig;
  /** Overrides for built-in UI strings (i18n). Optional. */
  ui?: Record<string, string>;
}

/** A heading extracted during render, used for the table of contents. */
export interface Heading {
  level: number;
  text: string;
  slug: string;
}

/** A discovered + parsed Markdown page. */
export interface Page {
  /** Source path relative to contentDir, e.g. "AI Notes/Foo.md". */
  sourcePath: string;
  /** URL slug, lowercased, '/'-separated, no extension. '' = home page. */
  slug: string;
  /** Output file path relative to outDir, e.g. "ai-notes/foo/index.html". */
  outPath: string;
  /** Public, root-relative URL, e.g. "/ai-notes/foo/" ("/" for home). */
  url: string;
  title: string;
  description: string;
  frontmatter: Record<string, unknown>;
  /** Raw Markdown body (frontmatter stripped). */
  body: string;
  tags: string[];
  date?: string;
  draft: boolean;
  /** Per-page language override for <html lang> (frontmatter `lang`). Optional. */
  lang?: string;
  /** Extra slugs this page also answers to (frontmatter `aliases`), emitted as redirects. */
  aliases: string[];
  /** Word count of the body (filled during collection). */
  words: number;
  /** Estimated reading time in minutes (filled during collection). */
  readingTime: number;
  /** Slugs of pages this page links to (filled during render). */
  links: string[];
  /** Slugs of pages that link to this page (filled after all renders). */
  backlinks: string[];
  /** Rendered HTML body (filled during render). */
  html: string;
  /** Headings for the TOC (filled during render). */
  headings: Heading[];
}

/** A non-Markdown file copied verbatim (images, PDFs, etc.). */
export interface Asset {
  /** Source path relative to contentDir. */
  sourcePath: string;
  /** Output path relative to outDir (preserves folder structure). */
  outPath: string;
  /** Public, root-relative URL. */
  url: string;
  /** Intrinsic pixel dimensions, for images (filled during collection). Optional. */
  width?: number;
  height?: number;
}

export type EmbedResolution =
  | { kind: 'image'; src: string; alt: string; width?: number; height?: number }
  | { kind: 'note'; url: string; title: string; resolved: boolean };

export interface LinkResolution {
  url: string;
  resolved: boolean;
}

/**
 * Per-render environment passed to markdown-it. The wikilink rule reads these to
 * turn [[targets]] into real URLs and to record the page's outgoing links.
 */
export interface RenderEnv {
  resolveLink: (target: string, anchor: string) => LinkResolution;
  resolveEmbed: (target: string, alias: string) => EmbedResolution;
  /** Outgoing link slugs collected during this render. */
  outgoing: Set<string>;
  /** Headings collected during this render. */
  headings: Heading[];
}
