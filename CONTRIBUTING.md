# Contributing to mdgarden

This document outlines how to build, run, and test `mdgarden` locally.

## Local Development

### 1. Install Dependencies
Clone the repository and install the dependencies:
```bash
npm install
```
This will automatically build the assets via the `prepare` lifecycle hook.

### 2. Development commands
- **Watch mode** (esbuild rebuilds on change):
  ```bash
  npm run dev
  ```
- **Typecheck code**:
  ```bash
  npm run typecheck
  ```
- **Full Production Build** (typechecks, bundles, and emits `.d.ts` definitions):
  ```bash
  npm run build
  ```

---

## Testing

`mdgarden` uses [Vitest](https://vitest.dev/) for unit and integration testing.

- **Run all tests once**:
  ```bash
  npm run test
  ```
- **Run tests in watch mode**:
  ```bash
  npm run test:watch
  ```

---

## Verifying Behavior with a Local Markdown Folder

You can test changes manually by building or serving the test fixtures (or any directory containing `.md` files) using the local CLI entry point:

### Build a Site
```bash
node dist/cli.js build test/fixtures -o build/test-output
```
Open `build/test-output/index.html` in your browser to verify the visual outputs and features.

### Serve a Site Locally (with Live Reload)
```bash
node dist/cli.js serve test/fixtures -o build/test-output
```
Open `http://localhost:3000` in your browser. Any changes you make to files under `test/fixtures` will trigger a rebuild and auto-reload the browser.

> [!NOTE]
> `test/fixtures` intentionally contains edge cases like broken frontmatter. The build must never crash when encountering them.

---

## Standalone Binary (Node SEA)

To bundle `mdgarden` as a single executable binary for your current OS and architecture:
```bash
npm run build:binary
```
The output executable will be placed in `build/mdgarden` (or `build/mdgarden.exe` on Windows).

> [!IMPORTANT]
> A Single Executable Application (SEA) must be built using an **official, statically-linked Node binary** that contains the fuse sentinel. Shared/Homebrew Node installations will **not** work.
> If your local Node was installed via Homebrew, download an official binary from [nodejs.org/dist](https://nodejs.org/dist) and set the `MDGARDEN_SEA_NODE` environment variable:
> ```bash
> MDGARDEN_SEA_NODE=/path/to/official/node/bin/node npm run build:binary
> ```

---

## Project Layout

| Path | Description |
| --- | --- |
| `src/` | Main source directory containing build config, render logic, and Markdown parsing |
| `src/cli/` | Command-line interface and the setup wizard |
| `src/client/` | Small, framework-free browser runtime scripts (dark mode, search, graph, tree) |
| `themes/` | Styling files, including the default layout stylesheets |
| `scripts/` | Helper scripts for packaging (`build-sea`, `embed-assets`, installers) |
| `test/` | Test suites and test markdown fixtures |
