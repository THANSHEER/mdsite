import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { DEFAULT_CONFIG, THEME_PRESETS, findPreset } from '../core/config.js';
import type { DarkModeMode, FeatureFlags, MdsiteConfig } from '../types.js';

// Default content of the .mdgardenignore file created by `mdgarden init`.
const DEFAULT_MDGARDENIGNORE = `# OS files
.DS_Store
Thumbs.db
desktop.ini

# Node / package managers
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build outputs
dist/
build/
public/
.output/

# Editors
.vscode/
.idea/
*.swp
*.swo

# Environment / secrets
.env
.env.*
.env.local

# Version control
.git/

# Obsidian vault settings
.obsidian/

# AI assistant folders
.claude/
.cursor/
.gemini/

# mdgarden config (not content)
mdgarden.config.json
`;

export const CONFIG_FILENAME = 'mdgarden.config.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if interactive prompting is supported. */
export function canPrompt(yes: boolean): boolean {
  return !yes && !p.isCI() && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

/** Check if config exists. */
export async function configExists(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, CONFIG_FILENAME));
    return true;
  } catch {
    return false;
  }
}

// Wizard defaults.
export interface WizardDefaults {
  title?: string;
  theme?: string;
  darkMode?: DarkModeMode;
}

const FEATURE_OPTIONS: { value: keyof FeatureFlags; label: string; hint: string }[] = [
  { value: 'explorer', label: 'File Explorer', hint: 'folder structure sidebar navigation' },
  { value: 'search', label: 'Search', hint: 'instant full-text search on every page' },
  { value: 'graph', label: 'Graph View', hint: 'interactive knowledge graph visualization' },
  { value: 'backlinks', label: 'Backlinks', hint: 'show what links reference each note' },
  { value: 'tags', label: 'Tags', hint: 'create tag index and per-tag pages' },
  { value: 'breadcrumbs', label: 'Breadcrumbs', hint: 'show navigation path at top' },
  { value: 'math', label: 'Math (KaTeX)', hint: 'render $…$ LaTeX formulae' },
  { value: 'syntaxHighlight', label: 'Syntax Highlighting', hint: 'beautiful code block syntax coloring' },
  { value: 'mermaid', label: 'Diagrams (Mermaid)', hint: 'render flowcharts, graphs, timelines' },
  { value: 'readingTime', label: 'Reading Time', hint: 'estimate minutes to read each note' },
  { value: 'rss', label: 'RSS Feed', hint: 'generate rss.xml for feed readers' },
  { value: 'sitemap', label: 'Sitemap', hint: 'generate sitemap.xml for SEO' },
];

const ALL_FEATURES = FEATURE_OPTIONS.map((f) => f.value);

function cancelled<T>(value: T | symbol): value is symbol {
  if (p.isCancel(value)) {
    p.cancel('Setup cancelled — no changes written.');
    process.exit(0);
  }
  return false;
}

/** Compose config from wizard answers. */
function composeConfig(answers: {
  title: string;
  description: string;
  baseUrl: string;
  author: string;
  logo?: string;
  themeId: string;
  darkMode: DarkModeMode;
  features: (keyof FeatureFlags)[];
  landingPage?: string;
}): MdsiteConfig {
  const preset = findPreset(answers.themeId) ?? THEME_PRESETS[0];
  const features = {} as FeatureFlags;
  for (const key of ALL_FEATURES) features[key] = answers.features.includes(key);

  return {
    ...DEFAULT_CONFIG,
    site: {
      ...DEFAULT_CONFIG.site,
      title: answers.title,
      description: answers.description,
      baseUrl: answers.baseUrl.replace(/\/+$/, ''),
      author: answers.author,
      ...(answers.logo ? { logo: answers.logo } : {}),
    },
    theme: {
      ...DEFAULT_CONFIG.theme,
      name: preset.id,
      darkMode: answers.darkMode,
      colors: preset.colors,
      fonts: preset.fonts,
    },
    nav: [{ title: 'Home', url: '/' }],
    features,
    build: {
      ...DEFAULT_CONFIG.build,
      // An explicit '' means "no landing file" → build auto-generates the notes-list home.
      landingPage: answers.landingPage ?? 'index.md',
    },
  };
}

async function writeConfig(cwd: string, config: MdsiteConfig): Promise<string> {
  const target = path.join(cwd, CONFIG_FILENAME);
  await fs.writeFile(target, `${JSON.stringify(config, null, 2)}\n`);
  return target;
}

/** Get default configuration (used when --yes skips the wizard). */
export function defaultConfig(cwd: string, defaults: WizardDefaults = {}): MdsiteConfig {
  return composeConfig({
    title: defaults.title ?? (path.basename(cwd) || 'My Notes'),
    description: DEFAULT_CONFIG.site.description,
    baseUrl: '',
    author: '',
    themeId: defaults.theme ?? 'default',
    darkMode: defaults.darkMode ?? 'toggle',
    features: ALL_FEATURES,
  });
}

export interface LandingProfile {
  name: string;
  role: string;
  about: string;
  /** Image path/URL, relative to the content folder. Optional. */
  photo: string;
}

/** A YAML double-quoted scalar (JSON strings are valid YAML). */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** Build an Obsidian-style author-profile landing page (Markdown). */
export function buildProfileMarkdown(profile: LandingProfile): string {
  const name = profile.name.trim() || 'Home';
  const lines: string[] = ['---', `title: ${yamlString(name)}`];
  if (profile.role.trim()) lines.push(`description: ${yamlString(profile.role.trim())}`);
  lines.push('---', '');
  if (profile.role.trim()) lines.push(`**${profile.role.trim()}**`, '');
  if (profile.photo.trim()) lines.push(`![${name}](${profile.photo.trim()})`, '');
  lines.push('## a little about me', '');
  lines.push(profile.about.trim() || 'Write a few words about yourself here.', '');
  return lines.join('\n');
}

const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', '.obsidian', '.claude', 'dist', 'build', 'public']);

/** Detect landing page file. */
async function detectLandingPage(contentDir: string, relDir = ''): Promise<string | null> {
  const dirAbs = path.join(contentDir, relDir);
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return null;
  }

  const files: string[] = [];
  const dirs: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (!IGNORED_DIR_NAMES.has(entry.name)) dirs.push(entry.name);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(entry.name);
    }
  }

  if (files.includes('index.md')) {
    return path.join(relDir, 'index.md').split(path.sep).join('/');
  }
  files.sort((a, b) => a.localeCompare(b));
  if (files.length > 0) {
    return path.join(relDir, files[0]).split(path.sep).join('/');
  }

  dirs.sort((a, b) => a.localeCompare(b));
  for (const dir of dirs) {
    const found = await detectLandingPage(contentDir, path.join(relDir, dir));
    if (found) return found;
  }
  return null;
}

/**
 * Offer to generate a landing page. Returns the chosen `landingPage` value
 * ('' means "auto-generate the notes-list home") and, when a file was written,
 * its relative path so callers can avoid scaffolding a duplicate.
 */
async function promptCreateLanding(
  cwd: string,
  author: string,
): Promise<{ landingPage: string; createdPath?: string }> {
  const create = await p.confirm({
    message: 'Create a landing (home) page now?',
    initialValue: true,
  });
  cancelled(create);
  if (!create) {
    // Fall back to the auto-generated notes-list home page.
    return { landingPage: '' };
  }

  const name = await p.text({
    message: 'Your name (landing page heading)',
    placeholder: author || 'Your name',
    defaultValue: author || '',
  });
  cancelled(name);

  const role = await p.text({
    message: 'Role / tagline (optional)',
    placeholder: 'e.g. Soil Scientist · Educator',
    defaultValue: '',
  });
  cancelled(role);

  const about = await p.text({
    message: 'A short "about me" intro (optional)',
    placeholder: 'A sentence or two about you and your notes…',
    defaultValue: '',
  });
  cancelled(about);

  const photo = await p.text({
    message: 'Profile image path, relative to your content folder (optional)',
    placeholder: 'profile.jpg',
    defaultValue: '',
  });
  cancelled(photo);

  // Pick a filename that does not clobber an existing file.
  let filename = 'index.md';
  if (existsSync(path.join(cwd, filename))) {
    const alt = await p.text({
      message: '"index.md" already exists — filename for the new landing page',
      placeholder: 'home.md',
      defaultValue: 'home.md',
      validate(value) {
        const v = (value ?? '').trim();
        if (!v) return 'Enter a filename';
        if (!v.toLowerCase().endsWith('.md')) return 'Must end with .md';
        if (existsSync(path.join(cwd, v))) return `"${v}" already exists`;
      },
    });
    cancelled(alt);
    filename = (alt as string).trim();
  }

  const markdown = buildProfileMarkdown({
    name: (name as string) || author,
    role: role as string,
    about: about as string,
    photo: photo as string,
  });
  await fs.writeFile(path.join(cwd, filename), markdown);
  return { landingPage: filename, createdPath: filename };
}

export interface WizardResult {
  config: MdsiteConfig;
  configPath: string;
  /** Relative path of a landing page generated by the wizard, if any. */
  createdLandingPage?: string;
}

/** Run interactive config wizard. */
export async function runConfigWizard(cwd: string): Promise<WizardResult> {
  p.intro('mdgarden — set up your site');

  const title = await p.text({
    message: 'Site name',
    placeholder: path.basename(cwd) || 'My Notes',
    defaultValue: path.basename(cwd) || 'My Notes',
  });
  cancelled(title);

  const description = await p.text({
    message: 'Short description',
    placeholder: DEFAULT_CONFIG.site.description,
    defaultValue: DEFAULT_CONFIG.site.description,
  });
  cancelled(description);

  const author = await p.text({
    message: 'Author name (optional)',
    placeholder: '',
    defaultValue: '',
  });
  cancelled(author);

  const logo = await p.text({
    message: 'Logo — emoji or image path (optional)',
    placeholder: '🌱  or  logo.png',
    defaultValue: '',
  });
  cancelled(logo);

  const themeId = await p.select({
    message: 'Theme',
    options: THEME_PRESETS.map((t) => ({ value: t.id, label: t.label, hint: t.hint })),
    initialValue: 'default',
  });
  cancelled(themeId);

  const darkMode = await p.select({
    message: 'Dark mode',
    options: [
      { value: 'toggle', label: 'Toggle', hint: 'OS default + a manual switch' },
      { value: 'auto', label: 'Auto', hint: 'follow the OS only' },
      { value: 'light', label: 'Light only', hint: '' },
      { value: 'dark', label: 'Dark only', hint: '' },
    ],
    initialValue: 'toggle',
  });
  cancelled(darkMode);

  // Pre-select ALL features — users deselect what they don't want (opt-out UX).
  const features = await p.multiselect({
    message: 'Features to enable (space to toggle, arrow keys to navigate)',
    options: FEATURE_OPTIONS,
    initialValues: ALL_FEATURES,
    required: false,
  });
  cancelled(features);

  const baseUrl = await p.text({
    message: 'Site URL (optional — used by RSS/sitemap)',
    placeholder: 'https://my-notes.pages.dev',
    defaultValue: '',
  });
  cancelled(baseUrl);

  let landingPage: string;
  let createdLandingPage: string | undefined;
  const detected = await detectLandingPage(cwd);
  if (detected) {
    const useDetected = await p.confirm({
      message: `Use "${detected}" as the landing page?`,
      initialValue: true,
    });
    cancelled(useDetected);
    if (useDetected) {
      landingPage = detected;
    } else {
      const res = await promptCreateLanding(cwd, author as string);
      landingPage = res.landingPage;
      createdLandingPage = res.createdPath;
    }
  } else {
    const res = await promptCreateLanding(cwd, author as string);
    landingPage = res.landingPage;
    createdLandingPage = res.createdPath;
  }

  const config = composeConfig({
    title: title as string,
    description: description as string,
    baseUrl: baseUrl as string,
    author: author as string,
    logo: logo as string,
    themeId: themeId as string,
    darkMode: darkMode as DarkModeMode,
    features: features as (keyof FeatureFlags)[],
    landingPage,
  });

  const configPath = await writeConfig(cwd, config);
  p.outro(`Wrote ${CONFIG_FILENAME} — you can edit it any time.`);
  return { config, configPath, createdLandingPage };
}

// ---------------------------------------------------------------------------
// initSite (previously cli/init.ts)
// ---------------------------------------------------------------------------

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface InitOptions {
  /** Skip the interactive wizard and scaffold with defaults. */
  yes?: boolean;
}

/** Scaffold a mdgarden.config.json and a sample content/ folder. */
export async function initSite(dir: string, opts: InitOptions = {}): Promise<void> {
  const root = path.resolve(process.cwd(), dir);
  await fs.mkdir(path.join(root, 'content'), { recursive: true });

  // Scaffold .mdgardenignore if it does not exist yet.
  const mdgardenignorePath = path.join(root, '.mdgardenignore');
  if (!(await fileExists(mdgardenignorePath))) {
    await fs.writeFile(mdgardenignorePath, DEFAULT_MDGARDENIGNORE);
  }

  let createdLanding: string | undefined;
  if (!(await configExists(root))) {
    if (canPrompt(Boolean(opts.yes))) {
      const result = await runConfigWizard(root);
      createdLanding = result.createdLandingPage;
    } else {
      const config = defaultConfig(root);
      await fs.writeFile(
        path.join(root, CONFIG_FILENAME),
        `${JSON.stringify(config, null, 2)}\n`,
      );
    }
  }

  // The wizard may have generated a landing page itself; don't scaffold a duplicate.
  const indexPath = path.join(root, 'content', 'index.md');
  if (!createdLanding && !(await fileExists(indexPath))) {
    const sample = `---
title: Home
---

# Welcome

This is your new mdgarden. Edit \`content/index.md\` and add more \`.md\` files,
then run \`mdgarden build\`.

Try a [[wikilink]] or a callout:

> [!tip] Tip
> Notes link to each other with [[double brackets]].
`;
    await fs.writeFile(indexPath, sample);
  }

  console.log(`✓ Initialised mdgarden in ${path.relative(process.cwd(), root) || '.'}`);
}
