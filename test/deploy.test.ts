import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publishSite, publishToCloudflare, publishToGithubPages } from '../src/core/deploy.js';

const execFileAsync = promisify(execFile);
const git = (args: string[], cwd: string) => execFileAsync('git', args, { cwd });

describe('publishSite', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-publish-opts-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('throws when no deploy target can be resolved', async () => {
    await expect(publishSite({ cwd: dir })).rejects.toThrow(/No deploy target specified/);
  });

  it('rejects an unknown target', async () => {
    await expect(publishSite({ cwd: dir, target: 'azure' as never })).rejects.toThrow(/Unknown deploy target/);
  });
});

describe('publishToCloudflare', () => {
  it('errors clearly when wrangler is not installed and npx is unavailable', async () => {
    // Use a cwd-relative PATH override so neither `wrangler` nor `npx` resolve.
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-cf-'));
    try {
      await expect(
        publishToCloudflareWithEmptyPath(dir),
      ).rejects.toThrow(/wrangler CLI not found/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

async function publishToCloudflareWithEmptyPath(cwd: string): Promise<void> {
  const originalPath = process.env.PATH;
  process.env.PATH = '';
  try {
    await publishToCloudflare(cwd, { cwd });
  } finally {
    process.env.PATH = originalPath;
  }
}

describe('publishToGithubPages (local bare remote)', () => {
  let remoteDir: string;
  let repoDir: string;
  let outDir: string;

  beforeEach(async () => {
    remoteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-bare-'));
    repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-repo-'));
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-out-'));

    await git(['init', '--bare', remoteDir], remoteDir);
    await git(['init'], repoDir);
    await git(['config', 'user.email', 'test@example.com'], repoDir);
    await git(['config', 'user.name', 'Test'], repoDir);
    await fs.writeFile(path.join(repoDir, 'README.md'), '# test\n');
    await git(['add', '-A'], repoDir);
    await git(['commit', '-m', 'init'], repoDir);
    await git(['remote', 'add', 'origin', remoteDir], repoDir);

    await fs.writeFile(path.join(outDir, 'index.html'), '<h1>hi</h1>');
  });

  afterEach(async () => {
    await fs.rm(remoteDir, { recursive: true, force: true });
    await fs.rm(repoDir, { recursive: true, force: true });
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it('creates an orphan gh-pages branch on first publish and pushes the built output', async () => {
    await publishToGithubPages(outDir, { cwd: repoDir, branch: 'gh-pages', message: 'deploy 1' });

    const { stdout } = await git(['ls-remote', '--heads', 'origin', 'gh-pages'], repoDir);
    expect(stdout.trim().length).toBeGreaterThan(0);
  });

  it('pushes an update on a second publish without recreating an orphan branch', async () => {
    await publishToGithubPages(outDir, { cwd: repoDir, branch: 'gh-pages', message: 'deploy 1' });

    await fs.writeFile(path.join(outDir, 'index.html'), '<h1>updated</h1>');
    await publishToGithubPages(outDir, { cwd: repoDir, branch: 'gh-pages', message: 'deploy 2' });

    const checkoutDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-checkout-'));
    try {
      await execFileAsync('git', ['clone', '--branch', 'gh-pages', remoteDir, checkoutDir]);
      const html = await fs.readFile(path.join(checkoutDir, 'index.html'), 'utf8');
      expect(html).toBe('<h1>updated</h1>');

      const log = await execFileAsync('git', ['log', '--oneline'], { cwd: checkoutDir });
      expect(log.stdout.trim().split('\n').length).toBe(2);
    } finally {
      await fs.rm(checkoutDir, { recursive: true, force: true });
    }
  });
});
