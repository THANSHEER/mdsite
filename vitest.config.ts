import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/client/**', // browser runtime, exercised manually in-browser
        'src/cli/serve.ts', // dev server, requires a live socket/browser
        // cli.ts calls cli.parse() at import time and publish.ts is its thin
        // wrapper — both are exercised black-box in test/cli.test.ts by
        // spawning dist/cli.js, which v8 coverage can't attribute back here.
        'src/cli/cli.ts',
        'src/cli/publish.ts',
        '**/*.d.ts',
      ],
      // Floors set just under current coverage so CI catches regressions
      // without being flaky; raise these as coverage improves.
      thresholds: {
        statements: 78,
        branches: 62,
        functions: 85,
        lines: 80,
      },
    },
  },
});
