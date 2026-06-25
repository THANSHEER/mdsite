// Sidebar explorer folder tree interactivity.

const STORE_KEY = 'mdgarden-explorer';

function loadState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveState(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable (private mode) — ignore */
  }
}

/** Get unique key for folder path. */
function folderKey(li: HTMLElement): string {
  const parts: string[] = [];
  let el: HTMLElement | null = li;
  while (el) {
    if (el.classList.contains('explorer-folder')) {
      const label = el.querySelector(':scope > .folder-label')?.textContent?.trim();
      if (label) parts.unshift(label);
    }
    el = el.parentElement;
  }
  return parts.join('/');
}

export function initExplorer(): void {
  const root = document.querySelector('.explorer-list');
  if (!root) return;

  const state = loadState();

  // Apply any remembered state on top of the server-rendered defaults.
  root.querySelectorAll<HTMLElement>('.explorer-folder').forEach((li) => {
    const key = folderKey(li);
    if (key in state) li.classList.toggle('is-open', state[key]);
  });

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    let toggle = target.closest('.folder-toggle');
    

    if (!toggle && target.closest('span.folder-label')) {
      const folderLi = target.closest('.explorer-folder');
      if (folderLi) {
        toggle = folderLi.querySelector('.folder-toggle');
      }
    }

    if (!toggle) return;
    const li = toggle.closest('.explorer-folder') as HTMLElement | null;
    if (!li) return;
    const open = li.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    state[folderKey(li)] = open;
    saveState(state);
  });
}
