// Plugin system for mdsite.

import type MarkdownIt from 'markdown-it';
import type { MdsiteConfig, Page } from '../types.js';

export type PageKind = 'note' | 'home' | 'tag' | 'folder' | '404';

/** What the head/bodyEnd hooks learn about the document being rendered. */
export interface RenderInfo {
  kind: PageKind;
  /** Root-relative, base-prefixed page URL (e.g. "/notes/foo/"). */
  url: string;
  title: string;
  description: string;
  /** Frontmatter for real notes; undefined for generated pages. */
  frontmatter?: Record<string, unknown>;
}

/** An extra file a plugin asks the build to write (path is relative to outDir). */
export interface EmitFile {
  path: string;
  content: string | Uint8Array;
}

/** Build-wide context handed to the page/emit hooks. */
export interface PluginContext {
  config: MdsiteConfig;
  pages: Page[];
  outDir: string;
}

/** Plugin interface for extending the build pipeline. */
export interface MdsitePlugin {
  name: string;
  markdown?(md: MarkdownIt, config: MdsiteConfig): void;
  page?(page: Page, ctx: PluginContext): void | Promise<void>;
  head?(info: RenderInfo, config: MdsiteConfig): string;
  bodyEnd?(info: RenderInfo, config: MdsiteConfig): string;
  emit?(ctx: PluginContext): EmitFile[] | Promise<EmitFile[]>;
}

/** Collect HTML from plugin hooks. */
export function collectHtml(
  plugins: MdsitePlugin[],
  hook: 'head' | 'bodyEnd',
  info: RenderInfo,
  config: MdsiteConfig,
): string {
  let out = '';
  for (const p of plugins) {
    const fn = p[hook];
    if (fn) out += fn.call(p, info, config) || '';
  }
  return out;
}
