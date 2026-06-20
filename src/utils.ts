// Shared utility helpers (HTML escaping, text manipulation) and UI strings (i18n).

import type { MdsiteConfig } from './types.js';

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Humanize slug segment: "my-folder" → "My Folder". */
export function humanizeSlug(seg: string): string {
  return seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip HTML tags to plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// UI strings (i18n)
// ---------------------------------------------------------------------------

export const UI = {
  notes: 'Notes',
  onThisPage: 'On this page',
  linkedReferences: 'Linked references',
  graph: 'Graph',
  graphLocal: 'Local',
  graphGlobal: 'All notes',
  search: 'Search',
  searchPlaceholder: 'Search notes…',
  builtWith: 'Built with',
  pageNotFound: 'Page not found',
  pageNotFoundBody: 'Sorry, this page could not be found.',
  backHome: '← Back home',
  toggleDark: 'Toggle dark mode',
  minRead: 'min read',
  noNotes: 'No notes published yet.',
  tags: 'Tags',
  home: 'Home',
  menu: 'Menu',
} as const;

export type UIKey = keyof typeof UI;

/** Translate key to localized string. */
export function t(key: UIKey, config?: Pick<MdsiteConfig, 'ui'>): string {
  return config?.ui?.[key] ?? UI[key];
}
