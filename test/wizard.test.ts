import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProfileMarkdown, defaultConfig, redesignSite } from '../src/cli/wizard.js';

describe('buildProfileMarkdown', () => {
  it('renders a full profile with role, photo and about', () => {
    const md = buildProfileMarkdown({
      name: 'Dr. Yamina Pressler',
      role: 'Soil Scientist · Educator',
      about: 'I study soils.',
      photo: 'me.jpg',
    });
    expect(md).toContain('title: "Dr. Yamina Pressler"');
    expect(md).toContain('description: "Soil Scientist · Educator"');
    expect(md).toContain('**Soil Scientist · Educator**');
    expect(md).toContain('![Dr. Yamina Pressler](me.jpg)');
    expect(md).toContain('## a little about me');
    expect(md).toContain('I study soils.');
  });

  it('omits role/photo lines when not given and uses a placeholder about', () => {
    const md = buildProfileMarkdown({ name: 'Jane', role: '', about: '', photo: '' });
    expect(md).toContain('title: "Jane"');
    expect(md).not.toContain('description:');
    expect(md).not.toContain('![');
    expect(md).not.toMatch(/\*\*\s*\*\*/); // no empty bold
    expect(md).toContain('Write a few words about yourself here.');
  });

  it('falls back to "Home" when the name is blank', () => {
    const md = buildProfileMarkdown({ name: '  ', role: '', about: '', photo: '' });
    expect(md).toContain('title: "Home"');
  });
});

describe('defaultConfig', () => {
  it('defaults the landing page to index.md', () => {
    expect(defaultConfig('/tmp/site').build.landingPage).toBe('index.md');
  });
});

describe('redesignSite', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  it('applies a new theme preset and leaves other fields untouched', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-redesign-'));
    const original = defaultConfig(dir, { title: 'My Garden' });
    await fs.writeFile(path.join(dir, 'mdgarden.config.json'), JSON.stringify(original, null, 2));

    const { config, configPath } = await redesignSite(dir, { yes: true, theme: 'forest' });

    expect(config.theme.name).toBe('forest');
    expect(config.theme.colors.light.primary).toBe('#2f6f4f');
    expect(config.site.title).toBe('My Garden');
    expect(config.build.landingPage).toBe(original.build.landingPage);

    const onDisk = JSON.parse(await fs.readFile(configPath, 'utf8'));
    expect(onDisk.theme.name).toBe('forest');
  });

  it('rejects an unknown theme id', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-redesign-'));
    const original = defaultConfig(dir);
    await fs.writeFile(path.join(dir, 'mdgarden.config.json'), JSON.stringify(original, null, 2));

    await expect(redesignSite(dir, { yes: true, theme: 'nope' })).rejects.toThrow(/Unknown theme/);
  });

  it('errors when no config exists yet', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-redesign-'));
    await expect(redesignSite(dir, { yes: true, theme: 'forest' })).rejects.toThrow(/mdgarden init/);
  });

  it('errors when run non-interactively without a theme', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-redesign-'));
    const original = defaultConfig(dir);
    await fs.writeFile(path.join(dir, 'mdgarden.config.json'), JSON.stringify(original, null, 2));

    await expect(redesignSite(dir, { yes: true })).rejects.toThrow(/No theme specified/);
  });
});
