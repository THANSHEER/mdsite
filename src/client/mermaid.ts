// Mermaid runtime — this is a SEPARATE esbuild bundle (not imported by the main
// client). It is injected on demand by client/index.ts only when the page contains
// mermaid fences. The heavy mermaid dependency is isolated here intentionally.

import mermaid from 'mermaid';

function currentTheme(): 'dark' | 'default' {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark') return 'dark';
  if (explicit === 'light') return 'default';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
}

async function renderAll(): Promise<void> {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (nodes.length === 0) return;
  mermaid.initialize({ startOnLoad: false, theme: currentTheme() });
  for (const el of nodes) {
    // Store original markup for re-rendering.
    if (!el.dataset.src) el.dataset.src = el.textContent ?? '';
    else el.textContent = el.dataset.src;
    el.removeAttribute('data-processed');
  }
  try {
    await mermaid.run({ nodes });
  } catch {

  }
}

void renderAll();

// Re-render on theme change.
const observer = new MutationObserver(() => void renderAll());
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
