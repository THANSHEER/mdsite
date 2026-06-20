// Serve the built site locally with live reloading.

import { promises as fs, watch, type FSWatcher } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { build, type BuildOptions } from '../core/build.js';
import { loadConfig } from '../core/config.js';

const LIVE_RELOAD =
  `<script>(function(){try{var s=new EventSource('/__mdsite_livereload');` +
  `s.onmessage=function(){location.reload()};}catch(e){}})();</script>`;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
};

export interface ServeOptions extends BuildOptions {
  /** Port to listen on (default 3000; tries the next few if busy). */
  port?: number;
}

function injectReload(html: string): string {
  return html.includes('</body>')
    ? html.replace('</body>', `${LIVE_RELOAD}</body>`)
    : html + LIVE_RELOAD;
}

/** Build, serve, and watch. Resolves only on a fatal listen error (otherwise runs forever). */
export async function serve(opts: ServeOptions = {}): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();
  const { config, baseDir } = await loadConfig(opts.configPath, cwd);

  const contentDir = opts.contentDir
    ? path.resolve(cwd, opts.contentDir)
    : path.resolve(baseDir, config.build.contentDir);
  const outDir = opts.outDir
    ? path.resolve(cwd, opts.outDir)
    : path.resolve(baseDir, config.build.outDir);

  const rebuild = () => build({ ...opts, cwd, outDir });
  const first = await rebuild();
  console.log(`✓ Built ${first.pageCount} page(s)`);

  const clients = new Set<http.ServerResponse>();
  const reloadAll = (): void => {
    for (const c of clients) c.write('data: reload\n\n');
  };

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];

    if (url === '/__mdsite_livereload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('retry: 1000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    let rel = decodeURIComponent(url);
    if (rel.endsWith('/')) rel += 'index.html';
    const filePath = path.join(outDir, rel);
    if (!filePath.startsWith(outDir)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.html') {
        res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(injectReload(data.toString('utf8')));
      } else {
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' }).end(data);
      }
    } catch {
      try {
        const nf = await fs.readFile(path.join(outDir, '404.html'), 'utf8');
        res.writeHead(404, { 'Content-Type': MIME['.html'] }).end(injectReload(nf));
      } catch {
        res.writeHead(404, { 'Content-Type': MIME['.html'] }).end('<h1>404</h1>');
      }
    }
  });

  const port = await listen(server, opts.port ?? 3000);
  console.log(`  ➜  http://localhost:${port}/  (live reload on)`);

  // Watch files for changes.
  let timer: NodeJS.Timeout | undefined;
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const r = await rebuild();
        console.log(`↻ rebuilt ${r.pageCount} page(s)`);
        reloadAll();
      } catch (err) {
        console.error(`✗ rebuild failed: ${(err as Error).message}`);
      }
    }, 120);
  };

  const watchers: FSWatcher[] = [];
  try {
    watchers.push(watch(contentDir, { recursive: true }, schedule));
  } catch {
    watchers.push(watch(contentDir, schedule));
  }
  if (opts.configPath || baseDir) {
    const cfgFile = opts.configPath
      ? path.resolve(cwd, opts.configPath)
      : path.join(baseDir, 'mdsite.config.json');
    try {
      watchers.push(watch(cfgFile, schedule));
    } catch {
      /* no config file to watch */
    }
  }
  process.on('SIGINT', () => {
    for (const w of watchers) w.close();
    server.close();
    process.exit(0);
  });
}

/** Listen on `port`, trying the next few if it's in use. */
function listen(server: http.Server, port: number, attempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (p: number, left: number): void => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && left > 0) tryPort(p + 1, left - 1);
        else reject(err);
      });
      server.listen(p, () => resolve(p));
    };
    tryPort(port, attempts);
  });
}
