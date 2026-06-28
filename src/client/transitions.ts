import { initGraph } from './graph.js';
import { initToc } from './toc.js';
import { initPopovers } from './popover.js';
import { initExplorer } from './explorer.js';

export function initTransitions(): void {
  // @ts-ignore
  if (!document.startViewTransition) return;

  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (!link) return;

    const href = link.href;
    if (!href || href.startsWith('#') || link.target === '_blank' || link.hasAttribute('download')) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return; // External link
    if (url.pathname === window.location.pathname) return; // Same page

    e.preventDefault();

    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error('Failed to fetch');
      const html = await res.text();
      const newDoc = new DOMParser().parseFromString(html, 'text/html');

      // @ts-ignore
      document.startViewTransition(() => {
        // Update Title
        document.title = newDoc.title;

        // Update Main Content
        const currentMain = document.querySelector('main.content');
        const newMain = newDoc.querySelector('main.content');
        if (currentMain && newMain) {
          currentMain.innerHTML = newMain.innerHTML;
        }

        // Update Right Sidebar
        const currentRight = document.querySelector('.sidebar-right');
        const newRight = newDoc.querySelector('.sidebar-right');
        const layout = document.querySelector('.layout');
        
        if (currentRight && newRight) {
          currentRight.innerHTML = newRight.innerHTML;
          layout?.classList.remove('no-right');
        } else if (currentRight && !newRight) {
          currentRight.remove();
          layout?.classList.add('no-right');
        } else if (!currentRight && newRight) {
          layout?.classList.remove('no-right');
          layout?.insertAdjacentHTML('beforeend', `<aside class="sidebar sidebar-right">${newRight.innerHTML}</aside>`);
        }

        // Update active classes in Left Sidebar (Explorer & Page List)
        document.querySelectorAll('.sidebar-left .is-active').forEach(el => el.classList.remove('is-active'));
        const newPath = url.pathname;
        document.querySelectorAll(`.sidebar-left a[href="${newPath}"]`).forEach(el => el.classList.add('is-active'));

        // Re-initialize interactive components
        initGraph();
        initToc();
        initPopovers();
        
        // Re-init explorer (to bind folder toggles if we replaced it, though we didn't replace it here, 
        // we might need to open folders containing the new active link)
        initExplorer();
        
        // Load mermaid if needed
        if (document.querySelector('pre.mermaid') && !(window as any).mermaid) {
          const s = document.createElement('script');
          const base = document.documentElement.dataset.base ?? '';
          s.src = (base ? base : '') + '/mdgarden.mermaid.js';
          s.defer = true;
          document.body.appendChild(s);
        } else if (document.querySelector('pre.mermaid') && (window as any).mermaid) {
            (window as any).mermaid.run({ querySelector: 'pre.mermaid' });
        }

        // Scroll to top or hash
        if (url.hash) {
          const targetEl = document.querySelector(url.hash);
          if (targetEl) targetEl.scrollIntoView();
        } else {
          window.scrollTo(0, 0);
        }
        
        // Update history
        window.history.pushState({}, '', href);
      });

    } catch (err) {
      console.error('View transition failed, falling back to normal navigation', err);
      window.location.href = href;
    }
  });

  // Handle back/forward buttons
  window.addEventListener('popstate', () => {
    window.location.reload();
  });
}
