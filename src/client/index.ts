// Client-side entrypoint.
import { initDarkMode } from './darkmode.js';
import { initSearch } from './search.js';
import { initGraph } from './graph.js';
import { initExplorer } from './explorer.js';
import { initSidebarToggle } from './sidebar.js';
import { initToc } from './toc.js';
import { initPopovers } from './popover.js';
import { initTransitions } from './transitions.js';

/** Prefix a root-relative URL with the base path stored on the <html> element. */
function withBase(url: string): string {
  const base = document.documentElement.dataset.base ?? '';
  if (!base) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  return base + url;
}

/** Load Mermaid runtime if needed. */
function loadMermaid(): void {
  if (!document.querySelector('pre.mermaid')) return;
  const s = document.createElement('script');
  s.src = withBase('/mdgarden.mermaid.js');
  s.defer = true;
  document.body.appendChild(s);
}

function start(): void {
  initDarkMode();
  initSearch();
  initGraph();
  initExplorer();
  initSidebarToggle();
  initToc();
  initPopovers();
  initTransitions();
  loadMermaid();
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
}
