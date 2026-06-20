import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, resolveConfig } from '../src/core/config.js';
import { UI, t } from '../src/utils.js';

describe('config defaults', () => {
  it('keeps new feature flags on (comments off) and base defaults', () => {
    const f = DEFAULT_CONFIG.features;
    expect([f.readingTime, f.mermaid, f.explorer, f.breadcrumbs]).toEqual([true, true, true, true]);
    expect(f.comments).toBe(false);
    expect(DEFAULT_CONFIG.build.basePath).toBe('');
    expect(DEFAULT_CONFIG.build.folderIndex).toBe(true);
    // build.ignore no longer exists — patterns live in .mdsiteignore
    expect('ignore' in DEFAULT_CONFIG.build).toBe(false);
  });

  it('deep-merges a partial user config onto the defaults (missing flags retained)', () => {
    const cfg = resolveConfig({ features: { graph: false } });
    expect(cfg.features.graph).toBe(false);
    expect(cfg.features.search).toBe(true); // untouched default survives
    expect(cfg.features.mermaid).toBe(true); // new default survives a partial features block
  });
});

describe('i18n', () => {
  it('falls back to the English default, honors ui overrides', () => {
    expect(t('onThisPage')).toBe(UI.onThisPage);
    expect(t('onThisPage', { ui: { onThisPage: 'Sur cette page' } })).toBe('Sur cette page');
  });
});
