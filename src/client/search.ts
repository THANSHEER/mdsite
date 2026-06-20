import MiniSearch from 'minisearch';

/** Escape HTML special chars (browser-safe, no Node imports). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Prefix a root-relative URL with the base path stored on the <html> element. */
function withBase(url: string): string {
  const base = document.documentElement.dataset.base ?? '';
  if (!base) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  return base + url;
}

interface Doc {
  id: string;
  url: string;
  title: string;
  tags: string;
  content: string;
}

/** Client search module. */
export function initSearch(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-search-open]');
  if (!button) return;
  const searchPlaceholder = button.dataset.placeholder || 'Search notes…';

  let mini: MiniSearch<Doc> | null = null;
  let loading = false;
  const docs = new Map<string, Doc>();
  let modal: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;
  let results: HTMLElement | null = null;

  async function ensureIndex(): Promise<void> {
    if (mini || loading) return;
    loading = true;
    try {
      const res = await fetch(withBase('/search-index.json'));
      const data = (await res.json()) as Doc[];
      for (const d of data) docs.set(d.id, d);
      const ms = new MiniSearch<Doc>({
        fields: ['title', 'tags', 'content'],
        storeFields: ['url', 'title'],
        searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 },
      });
      ms.addAll(data);
      mini = ms;
    } finally {
      loading = false;
    }
  }

  function ensureModal(): void {
    if (modal) return;
    const placeholder = searchPlaceholder;
    modal = document.createElement('div');
    modal.className = 'search-modal';
    modal.innerHTML =
      '<div class="search-box"><input type="search"><ul class="search-results"></ul></div>';
    document.body.appendChild(modal);
    input = modal.querySelector('input');
    results = modal.querySelector('.search-results');
    if (input) {
      input.placeholder = placeholder;
      input.setAttribute('aria-label', placeholder);
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    input?.addEventListener('input', () => runQuery(input?.value ?? ''));
  }

  async function open(): Promise<void> {
    ensureModal();
    await ensureIndex();
    modal?.classList.add('is-open');
    input?.focus();
    runQuery(input?.value ?? '');
  }

  function close(): void {
    modal?.classList.remove('is-open');
  }

  function runQuery(query: string): void {
    if (!mini || !results) return;
    const q = query.trim();
    const hits = q ? mini.search(q).slice(0, 20) : [];
    results.innerHTML = hits
      .map((hit) => {
        const doc = docs.get(String(hit.id));
        if (!doc) return '';
        const excerpt = excerptFor(doc.content, q);
        return `<li><a href="${doc.url}">${escapeHtml(doc.title)}<span class="search-result-excerpt">${escapeHtml(excerpt)}</span></a></li>`;
      })
      .join('');
  }

  button.addEventListener('click', () => {
    void open();
  });

  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    const typing =
      !!target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (e.key === 'Escape') {
      close();
      return;
    }
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      void open();
    }
  });
}

function excerptFor(content: string, query: string): string {
  const term = query.split(/\s+/)[0]?.toLowerCase() ?? '';
  const idx = term ? content.toLowerCase().indexOf(term) : -1;
  const start = idx > 50 ? idx - 50 : 0;
  const slice = content.slice(start, start + 140);
  return `${start > 0 ? '…' : ''}${slice}${content.length > start + 140 ? '…' : ''}`;
}
