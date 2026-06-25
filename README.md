<div align="center">

# mdgarden

**Turn a folder of Markdown notes into a fast, themeable static website.**

Search · Backlinks · Tags · Graph view · Dark mode · Math · Syntax highlighting — zero config, no runtime framework.

[![npm version](https://img.shields.io/npm/v/mdgarden.svg)](https://www.npmjs.com/package/mdgarden)
[![npm downloads](https://img.shields.io/npm/dm/mdgarden.svg)](https://www.npmjs.com/package/mdgarden)
[![CI](https://github.com/THANSHEER/mdsite/actions/workflows/ci.yml/badge.svg)](https://github.com/THANSHEER/mdsite/actions/workflows/ci.yml)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![Node version](https://img.shields.io/node/v/mdgarden.svg)](package.json)

[Installation](#installation) · [Features](#features) · [Quick Start](#quick-start) · [License](#license)

</div>

---

`mdgarden` is a lightweight, framework-free static-site generator: point it at a
folder of `.md` files and it renders a complete digital garden — search,
backlinks, tags, an interactive graph view, dark mode, math, and syntax
highlighting — with no runtime framework and no native dependencies. It speaks
Obsidian-flavored Markdown, so an Obsidian vault (or any pile of notes) works
out of the box.

> A GIF demo is coming in the next update.

## Features

| | |
|---|---|
| 🔗 **Obsidian-flavored Markdown** | `[[wikilinks]]`, `![[embeds]]`, `> [!note]` callouts, GFM, footnotes, math |
| 🧙 **Interactive setup** | First run asks for a name, theme, and features — no JSON to write by hand |
| 🎨 **Built-in themes** | `default`, `forest`, `rose`, `nord`, `ink` — all tweakable in one JSON config |
| 🔍 **Search & navigation** | Static search index, folder-tree explorer, breadcrumbs, backlinks, tags, graph |
| 🌙 **Rich rendering** | Dark mode, syntax highlighting (Shiki), math (KaTeX), lazy-loaded Mermaid diagrams, reading time |
| 📡 **SEO & sharing** | Social cards (OG/Twitter + canonical), `robots.txt`, RSS, sitemap, aliases/redirects, sub-path hosting |
| ⚡ **Dev experience** | Live-preview dev server (`mdgarden serve`) with auto-rebuild, a small plugin API, optional Giscus comments |
| 📦 **Reliable builds** | No native dependencies, no build-time downloads — fast, reproducible CI |
| 🧩 **Use it your way** | CLI, library, or standalone binary — npm · Homebrew · Docker · single-file download |

## Installation

Every method installs the same `mdgarden` command. The **npm** route needs Node ≥ 18;
the **standalone binary** and **Homebrew** options need nothing else installed.

<table>
<tr><th>macOS / Linux</th><th>Windows (PowerShell)</th></tr>
<tr><td>

```bash
# Homebrew
brew tap THANSHEER/tap && brew install mdgarden

# npm (needs Node ≥ 18)
npm install -g mdgarden

# Standalone binary, no Node
curl -fsSL https://raw.githubusercontent.com/THANSHEER/mdsite/main/scripts/install.sh | sh
```

</td><td>

```powershell
# npm (needs Node ≥ 18)
npm install -g mdgarden

# Standalone binary, no Node
irm https://raw.githubusercontent.com/THANSHEER/mdsite/main/scripts/install.ps1 | iex
```

</td></tr>
</table>

```bash
# Or run without installing anything (needs Node ≥ 18)
npx mdgarden build
```

Prebuilt binaries for every platform are also attached to each
[GitHub release](https://github.com/THANSHEER/mdsite/releases).

## Quick Start

```bash
# Point mdgarden at a folder of notes and build a static site
mdgarden build ./my-notes -o ./dist

# Or run the interactive setup wizard for a guided first build
mdgarden init

# Live-preview while you write, with auto-rebuild on save
mdgarden serve ./my-notes
```

## License

[GPL-3.0-or-later](LICENSE) © 2026 Mohammed Thanseer
