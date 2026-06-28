// Leaf module (no imports) so build.ts/render.ts can read the version
// without creating a cycle back through index.ts.
// @ts-ignore: MDGARDEN_VERSION is injected by esbuild at bundle time
export const VERSION = typeof MDGARDEN_VERSION !== 'undefined' ? MDGARDEN_VERSION : 'unknown';
