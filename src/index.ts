// Programmatic entry point for mdgarden.
export { VERSION } from './version.js';

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
export { initSite, redesignSite } from './cli/wizard.js';
export type { RedesignOptions, RedesignResult } from './cli/wizard.js';
export { publishSite, publishToGithubPages, publishToCloudflare } from './core/deploy.js';
export type { PublishOptions, PublishResult } from './core/deploy.js';
export type {
  MdsiteConfig,
  SiteConfig,
  ThemeConfig,
  ThemeColors,
  FeatureFlags,
  NavItem,
  FooterConfig,
  BuildConfig,
  DeployConfig,
  Page,
  Asset,
} from './types.js';
