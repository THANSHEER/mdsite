// Publish a built site directly to GitHub Pages or Cloudflare Pages.
// No bundled deploy dependencies: shells out to the `git` and `wrangler` CLIs.

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { build, type BuildOptions } from './build.js';
import { loadConfig } from './config.js';

const execFileAsync = promisify(execFile);

async function run(cmd: string, args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { cwd, maxBuffer: 32 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new Error((e.stderr ?? '').trim() || e.message);
  }
}

function git(args: string[], cwd: string): Promise<string> {
  return run('git', args, cwd);
}

/** Parse "git@github.com:owner/repo.git" / "https://github.com/owner/repo.git" → { owner, repo }. */
function parseGithubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function guessGithubPagesUrl(remoteUrl: string): string | null {
  const parsed = parseGithubRemote(remoteUrl);
  if (!parsed) return null;
  const { owner, repo } = parsed;
  return repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${repo}/`;
}

export interface GithubPagesOptions {
  cwd: string;
  branch?: string;
  message?: string;
  /** config.build.basePath — used only to warn about likely-wrong asset URLs. */
  basePath?: string;
}

/** Publish a built directory to a GitHub Pages branch via a throwaway git worktree. */
export async function publishToGithubPages(outDir: string, opts: GithubPagesOptions): Promise<void> {
  const { cwd } = opts;
  const branch = opts.branch ?? 'gh-pages';
  const message = opts.message ?? 'Deploy site';

  try {
    await git(['rev-parse', '--is-inside-work-tree'], cwd);
  } catch {
    throw new Error(`${cwd} is not a git repository — run "git init" and add a remote named "origin" first.`);
  }

  let remoteUrl: string;
  try {
    remoteUrl = await git(['remote', 'get-url', 'origin'], cwd);
  } catch {
    throw new Error('No git remote named "origin" — add one first, e.g. "git remote add origin <url>".');
  }

  const parsed = parseGithubRemote(remoteUrl);
  if (parsed && parsed.repo.toLowerCase() !== `${parsed.owner.toLowerCase()}.github.io` && !opts.basePath) {
    console.warn(
      `⚠  "${parsed.repo}" looks like a GitHub Pages project page (served from /${parsed.repo}/) ` +
      `but build.basePath is empty in mdgarden.config.json — asset URLs may be wrong once deployed.`,
    );
  }

  const remoteHeads = await git(['ls-remote', '--heads', 'origin', branch], cwd).catch(() => '');
  const branchExists = remoteHeads.trim().length > 0;

  const worktreeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdgarden-publish-'));
  try {
    if (branchExists) {
      await git(['fetch', 'origin', `${branch}:refs/remotes/origin/${branch}`], cwd);
      await git(['worktree', 'add', '--detach', worktreeDir, `origin/${branch}`], cwd);
      await git(['checkout', '-B', branch], worktreeDir);
    } else {
      await git(['worktree', 'add', '--detach', worktreeDir], cwd);
      await git(['checkout', '--orphan', branch], worktreeDir);
      await git(['rm', '-rf', '--quiet', '.'], worktreeDir).catch(() => {});
    }

    for (const entry of await fs.readdir(worktreeDir)) {
      if (entry === '.git') continue;
      await fs.rm(path.join(worktreeDir, entry), { recursive: true, force: true });
    }
    await fs.cp(outDir, worktreeDir, { recursive: true });

    await git(['add', '-A'], worktreeDir);
    const status = await git(['status', '--porcelain'], worktreeDir);
    if (status.length === 0) {
      console.log(`  Nothing changed — "${branch}" is already up to date.`);
      return;
    }
    await git(['commit', '-m', message], worktreeDir);
    await git(['push', 'origin', `HEAD:refs/heads/${branch}`], worktreeDir);
  } finally {
    await git(['worktree', 'remove', '--force', worktreeDir], cwd).catch(() => {});
    await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
  }

  const pagesUrl = guessGithubPagesUrl(remoteUrl);
  if (pagesUrl) console.log(`  ${pagesUrl}`);
}

export interface CloudflareOptions {
  cwd: string;
  projectName?: string;
}

async function resolveWranglerRunner(cwd: string): Promise<'wrangler' | 'npx' | null> {
  try {
    await run('wrangler', ['--version'], cwd);
    return 'wrangler';
  } catch {}
  try {
    await run('npx', ['--yes', 'wrangler', '--version'], cwd);
    return 'npx';
  } catch {}
  return null;
}

/** Publish a built directory to Cloudflare Pages via the `wrangler` CLI (not bundled). */
export async function publishToCloudflare(outDir: string, opts: CloudflareOptions): Promise<void> {
  const { cwd } = opts;
  const runner = await resolveWranglerRunner(cwd);
  if (!runner) {
    throw new Error(
      'wrangler CLI not found. Install it with "npm i -g wrangler" (or rely on npx) and run "wrangler login" first.',
    );
  }

  const pagesArgs = ['pages', 'deploy', outDir, ...(opts.projectName ? ['--project-name', opts.projectName] : [])];
  const [cmd, args] = runner === 'wrangler' ? ['wrangler', pagesArgs] : ['npx', ['--yes', 'wrangler', ...pagesArgs]];

  try {
    console.log(await run(cmd, args, cwd));
  } catch (err) {
    const message = (err as Error).message;
    if (/not.{0,20}authenticated|please login|wrangler login/i.test(message)) {
      throw new Error('Cloudflare authentication required — run "wrangler login" and try again.');
    }
    throw new Error(message);
  }
}

export interface PublishOptions extends BuildOptions {
  target?: 'github' | 'cloudflare';
  branch?: string;
  projectName?: string;
  message?: string;
}

export interface PublishResult {
  outDir: string;
  target: 'github' | 'cloudflare';
}

/** Build the site, then deploy the output to the configured static host. */
export async function publishSite(opts: PublishOptions = {}): Promise<PublishResult> {
  const cwd = opts.cwd ?? process.cwd();
  const { config } = await loadConfig(opts.configPath, cwd);

  const target = opts.target ?? config.deploy?.target;
  if (!target) {
    throw new Error(
      'No deploy target specified — pass --target <github|cloudflare> or set "deploy.target" in mdgarden.config.json.',
    );
  }
  if (target !== 'github' && target !== 'cloudflare') {
    throw new Error(`Unknown deploy target "${target}". Use "github" or "cloudflare".`);
  }

  const result = await build(opts);

  if (target === 'github') {
    await publishToGithubPages(result.outDir, {
      cwd,
      branch: opts.branch ?? config.deploy?.branch,
      message: opts.message,
      basePath: config.build.basePath,
    });
  } else {
    await publishToCloudflare(result.outDir, {
      cwd,
      projectName: opts.projectName ?? config.deploy?.projectName,
    });
  }

  return { outDir: result.outDir, target };
}
