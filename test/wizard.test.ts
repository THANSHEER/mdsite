import { describe, expect, it } from 'vitest';
import { buildProfileMarkdown, defaultConfig } from '../src/cli/wizard.js';

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
