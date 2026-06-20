import baseCss from '../../themes/default/base.css';
import type { MdsiteConfig, ThemeColors } from '../types.js';

function colorVars(c: ThemeColors): string {
  return [
    `--color-bg:${c.background}`,
    `--color-text:${c.text}`,
    `--color-primary:${c.primary}`,
    `--color-accent:${c.accent}`,
    `--color-muted:${c.muted}`,
    `--color-border:${c.border}`,
    `--color-surface:${c.surface}`,
  ].join(';');
}

/** Build site stylesheet. */
export function buildStyles(config: MdsiteConfig, customCss = ''): string {
  const { colors, fonts, darkMode } = config.theme;
  const light = colorVars(colors.light);
  const dark = colorVars(colors.dark);
  const fontVars =
    `--font-heading:${fonts.heading};--font-body:${fonts.body};--font-code:${fonts.code};`;

  let css = '';
  if (darkMode === 'dark') {
    css += `:root{${dark};${fontVars}}\n`;
  } else if (darkMode === 'light') {
    css += `:root{${light};${fontVars}}\n`;
  } else {
    css += `:root{${light};${fontVars}}\n`;
    css += `:root[data-theme="dark"]{${dark}}\n`;
    if (darkMode === 'auto' || darkMode === 'toggle') {
      css += `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}\n`;
    }
  }

  css += baseCss;
  if (customCss.trim()) css += `\n/* custom */\n${customCss}`;
  return css;
}
