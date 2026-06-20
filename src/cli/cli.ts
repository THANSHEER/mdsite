import path from 'node:path';
import { cac } from 'cac';
import { build } from '../core/build.js';
import { serve } from './serve.js';
import { initSite, canPrompt, configExists, runConfigWizard } from './wizard.js';
import { VERSION } from '../index.js';

const cli = cac('mdsite');

cli
  .command('build [contentDir]', 'Build a static site from a folder of Markdown')
  .option('-o, --out <dir>', 'Output directory (default: from config or "public")')
  .option('-c, --config <file>', 'Path to mdsite.config.json')
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
        console.log(`  mdsite build${contentDir ? ` ${contentDir}` : ''}${options.out ? ` --out ${options.out}` : ''}${options.config ? ` --config ${options.config}` : ''}`);
        console.log('');
        console.log('To serve locally with live reload:');
        console.log(`  mdsite serve${contentDir ? ` ${contentDir}` : ''}${options.out ? ` --out ${options.out}` : ''}${options.config ? ` --config ${options.config}` : ''}`);
      } catch (err) {
        console.error(`✗ Build failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    },
  );

cli
  .command('serve [contentDir]', 'Build and serve locally with live reload')
  .option('-p, --port <port>', 'Port to listen on (default: 3000)')
  .option('-o, --out <dir>', 'Output directory (default: from config or "public")')
  .option('-c, --config <file>', 'Path to mdsite.config.json')
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
  .command('init [dir]', 'Scaffold a mdsite.config.json and sample content')
  .option('-y, --yes', 'Skip prompts; scaffold with sensible defaults')
  .action(async (dir: string | undefined, options: { yes?: boolean }) => {
    try {
      await initSite(dir ?? '.', { yes: Boolean(options.yes) });
    } catch (err) {
      console.error(`✗ Init failed: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

cli.help();
cli.version(VERSION);
cli.parse();
