export function initToc(): void {
  const tocLinks = document.querySelectorAll('.toc-list a');
  if (tocLinks.length === 0) return;

  const observerOptions = {
    root: null,
    rootMargin: '-50px 0px -60% 0px', // Adjusted to trigger when heading is near the top
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    // Find the latest intersecting entry
    let activeId = '';
    
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        activeId = entry.target.getAttribute('id') || '';
      }
    });

    if (activeId) {
      // Remove active class from all
      tocLinks.forEach((link) => link.classList.remove('is-active'));
      
      // Add active class to the intersecting one
      const activeLink = document.querySelector(`.toc-list a[href="#${activeId}"]`);
      if (activeLink) {
        activeLink.classList.add('is-active');
        
        // Ensure the TOC itself is scrollable and scroll it if needed
        activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, observerOptions);

  // Observe all headings that have a corresponding TOC link
  tocLinks.forEach((link) => {
    const hash = new URL(link.getAttribute('href') || '', window.location.href).hash;
    if (hash) {
      // Escape the hash id for querySelector in case it starts with a number or has special chars
      try {
        const targetId = hash.slice(1);
        const target = document.getElementById(targetId);
        if (target) {
          observer.observe(target);
        }
      } catch (e) {
        console.warn('Could not observe TOC target', hash, e);
      }
    }
  });
}
