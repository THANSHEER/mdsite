import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MdsiteConfig, ThemeColors } from '../types.js';

// ---------------------------------------------------------------------------
// Theme presets
// ---------------------------------------------------------------------------

/** Theme preset options (used by the setup wizard). */
export interface ThemePreset {
  id: string;
  label: string;
  hint: string;
  colors: { light: ThemeColors; dark: ThemeColors };
  fonts: { heading: string; body: string; code: string };
}

const SANS = 'Inter, system-ui, -apple-system, sans-serif';
const SERIF = 'Georgia, Cambria, "Times New Roman", serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    label: 'Default',
    hint: 'Clean steel-blue, neutral background',
    fonts: { heading: SANS, body: SANS, code: MONO },
    colors: {
      light: {
        background: '#faf8f8', text: '#2b2b2b', primary: '#284b63',
        accent: '#84a59d', muted: '#6b6b6b', border: '#e5e5e5', surface: '#ffffff',
      },
      dark: {
        background: '#161618', text: '#ebebec', primary: '#7b97aa',
        accent: '#84a59d', muted: '#a0a0a0', border: '#33333a', surface: '#1e1e22',
      },
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    hint: 'Calm greens, garden feel',
    fonts: { heading: SANS, body: SANS, code: MONO },
    colors: {
      light: {
        background: '#f6f8f4', text: '#26302a', primary: '#2f6f4f',
        accent: '#7fae6f', muted: '#5f6b5f', border: '#dde6da', surface: '#ffffff',
      },
      dark: {
        background: '#141a16', text: '#e6ede6', primary: '#82c79a',
        accent: '#9fd08a', muted: '#9aa79a', border: '#2a352d', surface: '#1b231d',
      },
    },
  },
  {
    id: 'rose',
    label: 'Rosé',
    hint: 'Warm rose + plum, soft contrast',
    fonts: { heading: SANS, body: SANS, code: MONO },
    colors: {
      light: {
        background: '#fbf6f6', text: '#3a2b32', primary: '#a14a6b',
        accent: '#d98ca6', muted: '#7a6068', border: '#ecdde1', surface: '#ffffff',
      },
      dark: {
        background: '#1b1417', text: '#f0e3e8', primary: '#d98ca6',
        accent: '#e0a7bd', muted: '#a98e98', border: '#352830', surface: '#231a1e',
      },
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    hint: 'Cool nordic blue-grey',
    fonts: { heading: SANS, body: SANS, code: MONO },
    colors: {
      light: {
        background: '#f4f6f9', text: '#2e3440', primary: '#5e81ac',
        accent: '#88c0d0', muted: '#5b6675', border: '#dce1e8', surface: '#ffffff',
      },
      dark: {
        background: '#2e3440', text: '#eceff4', primary: '#88c0d0',
        accent: '#8fbcbb', muted: '#a9b1c0', border: '#3b4252', surface: '#3b4252',
      },
    },
  },
  {
    id: 'ink',
    label: 'Ink',
    hint: 'Minimal monochrome, serif body',
    fonts: { heading: SANS, body: SERIF, code: MONO },
    colors: {
      light: {
        background: '#ffffff', text: '#1a1a1a', primary: '#111111',
        accent: '#555555', muted: '#707070', border: '#e6e6e6', surface: '#fafafa',
      },
      dark: {
        background: '#0e0e0e', text: '#ededed', primary: '#fafafa',
        accent: '#b8b8b8', muted: '#8a8a8a', border: '#2a2a2a', surface: '#171717',
      },
    },
  },
];

/** Find theme preset by ID. */
export function findPreset(id: string): ThemePreset | undefined {
  const want = id.trim().toLowerCase();
  return THEME_PRESETS.find((p) => p.id === want);
}

// ---------------------------------------------------------------------------
// Default config & loading
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: MdsiteConfig = {
  site: {
    title: 'My Notes',
    description: 'Notes published with mdgarden',
    baseUrl: '',
    author: '',
    language: 'en',
  },
  theme: {
    name: 'default',
    darkMode: 'toggle',
    colors: {
      light: {
        background: '#faf8f8',
        text: '#2b2b2b',
        primary: '#284b63',
        accent: '#84a59d',
        muted: '#6b6b6b',
        border: '#e5e5e5',
        surface: '#ffffff',
      },
      dark: {
        background: '#161618',
        text: '#ebebec',
        primary: '#7b97aa',
        accent: '#84a59d',
        muted: '#a0a0a0',
        border: '#33333a',
        surface: '#1e1e22',
      },
    },
    fonts: {
      heading: SANS,
      body: SANS,
      code: MONO,
    },
  },
  nav: [],
  footer: {},
  features: {
    search: true,
    backlinks: true,
    tags: true,
    graph: true,
    math: true,
    syntaxHighlight: true,
    rss: true,
    sitemap: true,
    readingTime: true,
    mermaid: true,
    explorer: true,
    breadcrumbs: true,
    comments: false,
  },
  build: {
    contentDir: '.',
    outDir: 'public',
    basePath: '',
    landingPage: 'index.md',
    folderIndex: true,
  },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge overrides onto a base object. */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : (override as T);
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseValue = (base as Record<string, unknown>)[key];
    out[key] = isPlainObject(baseValue) && isPlainObject(value)
      ? deepMerge(baseValue, value)
      : value;
  }
  return out as T;
}

/** Resolve configuration. */
export function resolveConfig(input: unknown): MdsiteConfig {
  return deepMerge(DEFAULT_CONFIG, input);
}

export interface LoadedConfig {
  config: MdsiteConfig;
  /** Directory the config lives in (base for resolving contentDir/outDir/customCss). */
  baseDir: string;
  /** Path the config was loaded from, or null when defaults were used. */
  configPath: string | null;
}

/** Load mdgarden.config.json. */
export async function loadConfig(explicitPath: string | undefined, cwd: string): Promise<LoadedConfig> {
  const target = explicitPath
    ? path.resolve(cwd, explicitPath)
    : path.join(cwd, 'mdgarden.config.json');

  try {
    const raw = await fs.readFile(target, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return { config: resolveConfig(parsed), baseDir: path.dirname(target), configPath: target };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (explicitPath || code !== 'ENOENT') {
      throw new Error(`Could not read config at ${target}: ${(err as Error).message}`);
    }
    return { config: resolveConfig({}), baseDir: cwd, configPath: null };
  }
}
