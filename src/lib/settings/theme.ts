/**
 * The colour theme on the page: html[data-theme] (read by the tokens in globals.css) and the
 * browser's theme colour (the address bar on phones). Light unless the learner picks dark; the
 * choice is one of the account's settings (settings/model.ts), so nothing is stored in the browser.
 */
import type { Settings } from "./model";

/** The page background of each theme (globals.css → --bg). */
export const THEME_COLORS: Record<Settings["theme"], string> = { light: "#f7f4ee", dark: "#121315" };

export const otherTheme = (theme: Settings["theme"]): Settings["theme"] =>
  theme === "dark" ? "light" : "dark";

export function applyTheme(theme: Settings["theme"], doc: Document = document): void {
  doc.documentElement.setAttribute("data-theme", theme);
  doc.documentElement.style.colorScheme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}
