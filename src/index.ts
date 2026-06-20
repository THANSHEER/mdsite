// Programmatic entry point for mdsite.
// @ts-ignore: MDSITE_VERSION is injected by esbuild at bundle time
export const VERSION = typeof MDSITE_VERSION !== 'undefined' ? MDSITE_VERSION : 'unknown';

export { build } from './core/build.js';
export type { BuildOptions, BuildResult } from './core/build.js';
export type {
  MdsitePlugin,
  PluginContext,
  RenderInfo,
  EmitFile,
  PageKind,
} from './core/plugin.js';
export { loadConfig, resolveConfig, DEFAULT_CONFIG } from './core/config.js';
export { initSite } from './cli/wizard.js';
export type {
  MdsiteConfig,
  SiteConfig,
  ThemeConfig,
  ThemeColors,
  FeatureFlags,
  NavItem,
  FooterConfig,
  BuildConfig,
  Page,
  Asset,
} from './types.js';
