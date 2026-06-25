import { describe, expect, it } from 'vitest';
import { collectCodeLangs } from '../src/parser/highlight.js';

describe('collectCodeLangs (dynamic language detection)', () => {
  it('resolves ids and aliases, and ignores unknown languages', () => {
    const langs = collectCodeLangs([
      '```python\nx = 1\n```\n\n```c++\nint a;\n```\n\n```py\ny = 2\n```\n\n```made-up-xyz\nq\n```',
    ]);
    expect(langs).toContain('python'); // id and `py` alias both resolve here
    expect(langs).toContain('cpp'); // `c++` alias → canonical id
    expect(langs).not.toContain('made-up-xyz');
    expect(langs).not.toContain('c++');
  });

  it('dedupes an id and its alias to a single canonical id', () => {
    const langs = collectCodeLangs(['```cpp\na\n```', '```c++\nb\n```']);
    expect(langs.filter((l) => l === 'cpp')).toHaveLength(1);
  });

  it('supports languages that were never in the old hardcoded list', () => {
    const langs = collectCodeLangs(['```kotlin\nfun f(){}\n```', '```swift\nlet x=1\n```']);
    expect(langs).toEqual(expect.arrayContaining(['kotlin', 'swift']));
  });

  it('handles ~~~ fences and indentation', () => {
    const langs = collectCodeLangs(['   ~~~rust\nfn main(){}\n~~~']);
    expect(langs).toContain('rust');
  });
});
