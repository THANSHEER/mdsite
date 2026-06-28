import path from 'node:path';
import { cac } from 'cac';
import { build } from '../core/build.js';
import { serve } from './serve.js';
import { initSite, canPrompt, configExists, redesignSite, runConfigWizard } from './wizard.js';
import { publish } from './publish.js';
import { VERSION } from '../index.js';

const cli = cac('mdgarden');

cli
  .command('build [contentDir]', 'Build a static site from a folder of Markdown')
  .option('-o, --out <dir>', 'Output directory (default: from config or "public")')
  .option('-c, --config <file>', 'Path to mdgarden.config.json')
  .option('-y, --yes', 'Skip the interactive setup; build with config/defaults')
  .action(
    async (
      contentDir: string | undefined,
      options: { out?: string; config?: string; yes?: boolean },
    ) => {
      const cwd = process.cwd();
      try {
        // Run setup wizard if config does not exist and interactive prompting is possible.
        const hasConfig = options.config ? true : await configExists(cwd);
        if (!hasConfig && canPrompt(Boolean(options.yes))) {
          await runConfigWizard(cwd);
        }

        const started = Date.now();
        const result = await build({
          contentDir,
          outDir: options.out,
          configPath: options.config,
        });
        const rel = path.relative(cwd, result.outDir) || '.';
        console.log(
          `✓ Built ${result.pageCount} page(s), ${result.assetCount} asset(s) → ${rel} (${Date.now() - started}ms)`,
        );
        console.log('');
        console.log('To rebuild after making changes:');
        console.log(`  mdgarden build${contentDir ? ` ${contentDir}` : ''}${options.out ? ` --out ${options.out}` : ''}${options.config ? ` --config ${options.config}` : ''}`);
        console.log('');
        console.log('To serve locally with live reload:');
        console.log(`  mdgarden serve${contentDir ? ` ${contentDir}` : ''}${options.out ? ` --out ${options.out}` : ''}${options.config ? ` --config ${options.config}` : ''}`);
      } catch (err) {
        console.error(`✗ Build failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    },
  );

cli
  .command('rebuild [contentDir]', 'Rebuild the site from an existing mdgarden.config.json')
  .option('-o, --out <dir>', 'Output directory (default: from config or "public")')
  .option('-c, --config <file>', 'Path to mdgarden.config.json')
  .action(
    async (
      contentDir: string | undefined,
      options: { out?: string; config?: string },
    ) => {
      const cwd = process.cwd();
      try {
        const hasConfig = options.config ? true : await configExists(cwd);
        if (!hasConfig) {
          throw new Error('No mdgarden.config.json found — run "mdgarden init" first.');
        }

        const started = Date.now();
        const result = await build({
          contentDir,
          outDir: options.out,
          configPath: options.config,
        });
        const rel = path.relative(cwd, result.outDir) || '.';
        console.log(
          `✓ Rebuilt ${result.pageCount} page(s), ${result.assetCount} asset(s) → ${rel} (${Date.now() - started}ms)`,
        );
      } catch (err) {
        console.error(`✗ Rebuild failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    },
  );

cli
  .command('serve [contentDir]', 'Build and serve locally with live reload')
  .option('-p, --port <port>', 'Port to listen on (default: 3000)')
  .option('-o, --out <dir>', 'Output directory (default: from config or "public")')
  .option('-c, --config <file>', 'Path to mdgarden.config.json')
  .action(
    async (
      contentDir: string | undefined,
      options: { port?: string; out?: string; config?: string },
    ) => {
      try {
        await serve({
          contentDir,
          outDir: options.out,
          configPath: options.config,
          port: options.port ? Number(options.port) : undefined,
        });
      } catch (err) {
        console.error(`✗ Serve failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    },
  );

cli
  .command('init [dir]', 'Scaffold a mdgarden.config.json and sample content')
  .option('-y, --yes', 'Skip prompts; scaffold with sensible defaults')
  .action(async (dir: string | undefined, options: { yes?: boolean }) => {
    try {
      await initSite(dir ?? '.', { yes: Boolean(options.yes) });
    } catch (err) {
      console.error(`✗ Init failed: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

cli
  .command('redesign [dir]', 'Pick a new theme for an existing site and rebuild')
  .option('-y, --yes', 'Skip prompts (requires --theme)')
  .option('--theme <id>', 'Theme preset id (default, forest, rose, nord, ink)')
  .action(async (dir: string | undefined, options: { yes?: boolean; theme?: string }) => {
    try {
      const root = dir ?? '.';
      await redesignSite(root, { yes: Boolean(options.yes), theme: options.theme });
      const result = await build({ cwd: path.resolve(process.cwd(), root) });
      console.log(`✓ Redesigned and rebuilt ${result.pageCount} page(s) → ${path.relative(process.cwd(), result.outDir) || '.'}`);
    } catch (err) {
      console.error(`✗ Redesign failed: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

cli
  .command('publish [contentDir]', 'Build and deploy to GitHub Pages or Cloudflare Pages')
  .option('-o, --out <dir>', 'Output directory (default: from config or "public")')
  .option('-c, --config <file>', 'Path to mdgarden.config.json')
  .option('-t, --target <target>', 'Deploy target: github or cloudflare')
  .option('-b, --branch <branch>', 'Git branch for GitHub Pages (default: gh-pages)')
  .option('--project-name <name>', 'Cloudflare Pages project name')
  .option('-m, --message <message>', 'Commit message for the GitHub Pages deploy')
  .action(
    async (
      contentDir: string | undefined,
      options: {
        out?: string;
        config?: string;
        target?: string;
        branch?: string;
        projectName?: string;
        message?: string;
      },
    ) => {
      try {
        await publish({
          contentDir,
          outDir: options.out,
          configPath: options.config,
          target: options.target as 'github' | 'cloudflare' | undefined,
          branch: options.branch,
          projectName: options.projectName,
          message: options.message,
        });
      } catch (err) {
        console.error(`✗ Publish failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    },
  );

cli.help();
cli.version(VERSION);
cli.parse();
