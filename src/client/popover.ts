const POPOVER_DELAY = 400; // ms to hover before showing
const CACHE = new Map<string, string>();

let hoverTimer: number | null = null;
let currentPopover: HTMLElement | null = null;

export function initPopovers(): void {
  // Create popover container
  const popover = document.createElement('div');
  popover.id = 'md-popover';
  popover.className = 'md-popover';
  document.body.appendChild(popover);

  const hidePopover = () => {
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    popover.classList.remove('is-visible');
    currentPopover = null;
  };

  const showPopover = async (link: HTMLAnchorElement) => {
    const href = link.href;
    if (!href || href.startsWith('#') || link.classList.contains('wikilink-broken')) return;

    // Only internal links
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    hoverTimer = window.setTimeout(async () => {
      let contentHtml = CACHE.get(href);
      
      if (!contentHtml) {
        try {
          const res = await fetch(href);
          if (!res.ok) throw new Error('Failed to fetch');
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          
          // Extract the main content article
          const article = doc.querySelector('.md-content');
          if (article) {
             // Remove interactive elements that don't make sense in a popover
             article.querySelectorAll('script, .mermaid, .graph-panel, .md-popover').forEach(el => el.remove());
             contentHtml = article.innerHTML;
             CACHE.set(href, contentHtml);
          } else {
             contentHtml = '<p>Content not found.</p>';
          }
        } catch (err) {
          console.error('Error fetching popover content:', err);
          contentHtml = '<p>Failed to load preview.</p>';
        }
      }

      if (currentPopover !== link) return; // User moved mouse away while fetching

      popover.innerHTML = `<div class="md-popover-inner">${contentHtml}</div>`;
      
      // Position it near the cursor
      const rect = link.getBoundingClientRect();
      const popoverWidth = Math.min(500, window.innerWidth - 40);
      const popoverHeight = 300; // Max height in css

      let top = rect.bottom + window.scrollY + 10;
      let left = rect.left + window.scrollX;

      // Prevent going off right edge
      if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 20;
      }
      
      // Prevent going off bottom edge, flip to top if needed
      if (top - window.scrollY + popoverHeight > window.innerHeight && rect.top > popoverHeight) {
        top = rect.top + window.scrollY - popoverHeight - 10;
      }

      popover.style.top = `${top}px`;
      popover.style.left = `${Math.max(10, left)}px`;
      popover.classList.add('is-visible');
    }, POPOVER_DELAY);
  };

  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link && link.closest('.md-content')) {
      if (currentPopover !== link) {
        hidePopover();
        currentPopover = link;
        showPopover(link);
      }
    } else if (!target.closest('#md-popover')) {
      hidePopover();
    }
  });

  // Also hide when leaving the popover area
  popover.addEventListener('mouseleave', () => {
    hidePopover();
  });
  
  // Hide on scroll
  window.addEventListener('scroll', () => {
    if (popover.classList.contains('is-visible')) {
      hidePopover();
    }
  }, { passive: true });
}
