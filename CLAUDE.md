# Claude / AI Assistant Guidelines

This file provides crucial context for any AI assistant (like Claude, GitHub Copilot, Gemini, etc.) working on the `mdsite` repository. Please read this before proposing architectural changes or adding new features.

## Project Goal
`mdgarden` is a lightning-fast, zero-config static site generator that turns a folder of Markdown notes into a fully-featured digital garden (with backlinks, local/global interactive graphs, and search). 

It is designed to be **lightweight and framework-free**. It compiles rapidly and relies on minimal dependencies.

## Architecture

The source code (`src/`) is strictly modularized by domain:
- **`src/cli/`**: Command-line interfaces, the interactive setup wizard, and the live-reloading dev server.
- **`src/core/`**: The core build orchestrator (`build.ts`), configuration resolution (`config.ts`), file emission (`emit.ts`), and the plugin architecture.
- **`src/parser/`**: Everything related to transforming Markdown into HTML (markdown-it plugins, syntax highlighting, asset path resolution).
- **`src/features/`**: Static data generators that run at build-time to emit JSON (e.g., `graph.ts` for the network graph, `search.ts` for the search index, `explorer.ts` for the folder tree).
- **`src/client/`**: **BROWSER RUNTIME CODE.** This code runs on the client-side. It manages the interactive search modal, force-directed graph UI, dark mode toggles, and popovers.

## 🛑 What NOT To Do

1. **Do not mix Browser and Node.js environments.** 
   Files in `src/client/` are shipped directly to the browser. They **must not** import `fs`, `path`, or code from `src/core/`, `src/features/`, or `src/parser/`. 
2. **Do not introduce large frontend frameworks.**
   `mdgarden` prides itself on shipping minimal JavaScript. Do not propose adding React, Vue, Svelte, or TailwindCSS. Use Vanilla JS and standard CSS.
3. **Do not break the Single Executable App (SEA) compatibility.**
   `mdgarden` can be compiled into a standalone binary. Asset loading (like `mdgarden.client.js` or KaTeX fonts) is handled via `src/parser/assets.ts` which uses `node:sea` to read assets when bundled. Do not use standard `fs.readFile` for core assets without utilizing the asset resolver.
4. **Do not hardcode versions.**
   The version number is defined exclusively in `package.json`. It is injected globally into the runtime as `MDGARDEN_VERSION` via `esbuild.config.mjs` using `define`. Use `export const VERSION = typeof MDGARDEN_VERSION !== 'undefined' ? MDGARDEN_VERSION : 'unknown';` as seen in `src/index.ts`.

## ✅ What You SHOULD Do

1. **Follow the established style.**
   Use standard TypeScript, ESModules (`type: module`), and maintain strict typing.
2. **Write tests for new features.**
   Place tests in the `test/` directory using `vitest`. Ensure you test edge cases using the dummy markdown files in `test/fixtures/`.

