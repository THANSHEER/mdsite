import { escapeHtml } from '../utils.js';
import { withBase } from '../parser/links.js';
import type { MdsiteConfig, Page } from '../types.js';

function abs(baseUrl: string, url: string): string {
  return `${baseUrl.replace(/\/$/, '')}${url}`;
}

/** Build sitemap.xml. */
export function buildSitemap(pages: Page[], baseUrl: string): string {
  const urls = pages
    .map((p) => {
      const lastmod = p.date ? `<lastmod>${isoDate(p.date)}</lastmod>` : '';
      return `<url><loc>${escapeHtml(abs(baseUrl, p.url))}</loc>${lastmod}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

/** Build RSS feed. */
export function buildRss(pages: Page[], config: MdsiteConfig): string {
  const base = config.site.baseUrl;
  const items = pages
    .filter((p) => p.date)
    .sort((a, b) => (a.date! < b.date! ? 1 : -1))
    .slice(0, 20)
    .map((p) => {
      const link = escapeHtml(abs(base, p.url));
      const pubDate = p.date ? `<pubDate>${new Date(p.date).toUTCString()}</pubDate>` : '';
      return `<item><title>${escapeHtml(p.title)}</title><link>${link}</link><guid>${link}</guid>${pubDate}<description>${escapeHtml(p.description)}</description></item>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escapeHtml(config.site.title)}</title><link>${escapeHtml(abs(base, withBase('/')))}</link><description>${escapeHtml(config.site.description)}</description>${items}</channel></rss>\n`;
}

/** Build robots.txt. */
export function buildRobots(config: MdsiteConfig): string {
  const lines = ['User-agent: *', 'Allow: /'];
  const base = config.site.baseUrl.replace(/\/$/, '');
  if (base) lines.push(`Sitemap: ${base}${withBase('/sitemap.xml')}`);
  return `${lines.join('\n')}\n`;
}

function isoDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
}
