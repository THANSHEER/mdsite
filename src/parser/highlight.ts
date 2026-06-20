import { bundledLanguagesInfo, createHighlighter, type BundledLanguage } from 'shiki';

// Light/dark theme config for code highlighting. Languages are NOT hardcoded:
// whatever shiki bundles (300+ grammars + aliases) is supported automatically,
// and only the languages actually used in the content are loaded.
const THEMES = { light: 'github-light', dark: 'github-dark' } as const;

export type HighlightFn = (code: string, lang: string) => string;

// First token after a ``` or ~~~ fence opener (allows ids like c++, c#, objective-c).
const FENCE_RE = /^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*([A-Za-z0-9+#._-]+)/gm;

// Every shiki language id + alias → its canonical bundled id (e.g. "c++" → "cpp").
const LANG_BY_TOKEN = new Map<string, BundledLanguage>();
for (const info of bundledLanguagesInfo) {
  LANG_BY_TOKEN.set(info.id, info.id as BundledLanguage);
  for (const alias of info.aliases ?? []) LANG_BY_TOKEN.set(alias, info.id as BundledLanguage);
}

/** Resolve a fence token (id or alias) to a shiki bundled language id, or undefined. */
function canonicalLang(token: string): BundledLanguage | undefined {
  return LANG_BY_TOKEN.get(token.toLowerCase());
}

/** Collect the shiki languages actually used across the given markdown sources. */
export function collectCodeLangs(bodies: Iterable<string>): BundledLanguage[] {
  const ids = new Set<BundledLanguage>();
  for (const body of bodies) {
    for (const match of body.matchAll(FENCE_RE)) {
      const id = canonicalLang(match[1]);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Create a syntax highlighter that supports exactly the languages used in the
 * content. Unknown/unspecified languages degrade to an (unhighlighted) plain
 * code block rather than failing.
 */
export async function createCodeHighlighter(langs: BundledLanguage[] = []): Promise<HighlightFn> {
  const highlighter = await createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs,
  });
  const loaded = new Set(highlighter.getLoadedLanguages());

  return (code: string, lang: string): string => {
    const key = (lang || '').toLowerCase();
    const resolved = key && loaded.has(key) ? key : 'text';
    return highlighter.codeToHtml(code, {
      lang: resolved,
      themes: THEMES,
      defaultColor: false,
    });
  };
}
