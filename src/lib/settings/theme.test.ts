// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./model";
import { applyTheme, otherTheme, THEME_COLORS } from "./theme";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = "";
});

describe("theme", () => {
  it("is light by default; old accounts' 'auto' reads as light", () => {
    expect(DEFAULT_SETTINGS.theme).toBe("light");
    expect(sanitizeSettings({ theme: "auto" }).theme).toBe("light");
    expect(sanitizeSettings({ theme: "dark" }).theme).toBe("dark");
    expect(otherTheme("light")).toBe("dark");
    expect(otherTheme("dark")).toBe("light");
  });

  it("sets data-theme, the colour scheme and the browser's theme colour", () => {
    document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.light}">`;
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      THEME_COLORS.dark,
    );
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
