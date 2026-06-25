/** Initialize dark mode behavior. */
export function initDarkMode(): void {
  const KEY = 'mdgarden-theme';
  const root = document.documentElement;
  const stored = localStorage.getItem(KEY);
  if (stored === 'dark' || stored === 'light') root.dataset.theme = stored;

  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem(KEY, next);
  });
}
