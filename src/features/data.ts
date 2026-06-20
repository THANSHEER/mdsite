// Build-time data serializers: search index and graph JSON.

import { stripHtml } from '../utils.js';
import type { Page } from '../types.js';

// ---------------------------------------------------------------------------
// Search index
// ---------------------------------------------------------------------------

export interface SearchDoc {
  id: string;
  url: string;
  title: string;
  tags: string;
  content: string;
}

/** Build search index JSON. */
export function buildSearchIndex(pages: Page[]): string {
  const docs: SearchDoc[] = pages.map((page, i) => ({
    id: String(i),
    url: page.url,
    title: page.title,
    tags: page.tags.join(' '),
    content: stripHtml(page.html).slice(0, 4000),
  }));
  return JSON.stringify(docs);
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  title: string;
  url: string;
}
interface GraphLink {
  source: string;
  target: string;
}

/** Build interactive graph data. */
export function buildGraph(pages: Page[]): string {
  const ids = new Set(pages.map((p) => p.slug));
  const nodes: GraphNode[] = pages.map((p) => ({ id: p.slug, title: p.title, url: p.url }));

  const seen = new Set<string>();
  const links: GraphLink[] = [];
  for (const page of pages) {
    for (const target of page.links) {
      if (!ids.has(target) || target === page.slug) continue;
      const key = `${page.slug}\0${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: page.slug, target });
    }
  }

  return JSON.stringify({ nodes, links });
}
