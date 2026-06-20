# mdsite

**Turn a folder of Markdown notes into a fast static website.** mdsite is a
lightweight, framework-free static-site generator: point it at a folder of `.md`
files and it renders a complete, themeable site — search, backlinks, tags, a
graph view, dark mode, math and syntax highlighting — with no runtime framework
and no native dependencies. It speaks Obsidian-flavored Markdown, so an Obsidian
vault (or any pile of notes) works out of the box.

> A GIF demo is coming in the next update.

## Features

- 🔗 **Obsidian-flavored Markdown** — `[[wikilinks]]`, `![[embeds]]`, `> [!note]` callouts, GFM, footnotes, math
- 🧙 **Interactive setup** — the first run asks for a name, theme, and features; no JSON to write by hand
- 🎨 **Built-in themes** — pick `default`, `forest`, `rose`, `nord`, or `ink` (all tweakable in one JSON config)
- 🔍 **Search, folder-tree explorer, breadcrumbs, backlinks, tags, graph** — all static, no runtime framework
- 🌙 **Dark mode**, syntax highlighting (Shiki), math (KaTeX), **Mermaid diagrams** (lazy-loaded), reading time
- 🔗 **Social cards** (OG/Twitter + canonical), `robots.txt`, RSS, sitemap, **aliases/redirects**, **sub-path hosting**
- ⚡ **Live-preview dev server** (`mdsite serve`) with auto-rebuild, plus a small **plugin API** and optional **Giscus comments**
- 📦 **No native dependencies, no build-time downloads** — fast, reliable CI builds
- 🧩 Use it as a **CLI**, a **library**, or a **standalone binary** — npm · Homebrew · Docker · single-file download

## Installation

Every method installs the same `mdsite` command. The **npm** route needs Node ≥ 18;
the **standalone binary** and **Homebrew** options need nothing else installed.

### macOS

```bash
# Homebrew
brew tap THANSHEER/tap && brew install mdsite

# npm (needs Node ≥ 18)
npm install -g mdsite

# Standalone binary, no Node → /usr/local/bin (or ~/.local/bin)
curl -fsSL https://raw.githubusercontent.com/THANSHEER/mdsite/main/scripts/install.sh | sh
```

### Windows (PowerShell)

```powershell
# npm (needs Node ≥ 18)
npm install -g mdsite

# Standalone binary, no Node
irm https://raw.githubusercontent.com/THANSHEER/mdsite/main/scripts/install.ps1 | iex
```

### npm (any OS)

```bash
npm install -g mdsite     # global CLI
npx mdsite build          # or run without installing (needs Node)
```

Prebuilt binaries for every platform are also attached to each
[GitHub release](https://github.com/THANSHEER/mdsite/releases).

## License

[GPL-3.0-or-later](LICENSE) © 2026 Mohammed Thanseer
