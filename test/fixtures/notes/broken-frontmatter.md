---
title: Broken
tags: [a, b
date: 2026-02-02
---

# Broken Frontmatter

The YAML block above is invalid (an unclosed `[`). gray-matter throws on it, so
the build must fall back to treating the file as plain content and never crash.
