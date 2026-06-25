// Mobile sidebar drawer toggle.

export function initSidebarToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]');
  if (!toggle) return;
  const backdrop = document.querySelector<HTMLElement>('[data-sidebar-backdrop]');
  const sidebar = document.querySelector<HTMLElement>('.sidebar-left');

  const close = (): void => document.body.classList.remove('sidebar-open');

  toggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  backdrop?.addEventListener('click', close);
  sidebar?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}
