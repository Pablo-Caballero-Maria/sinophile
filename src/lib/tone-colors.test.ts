/** The tone colours in globals.css: 1 blue, 2 green, 3 yellow, 4 red, neutral grey, readable in both themes. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
/** One palette per block: light, forced dark, automatic dark. */
const palettes = [
  ...css.matchAll(
    /--tone-1: (#\w+);\s+--tone-2: (#\w+);\s+--tone-3: (#\w+);\s+--tone-4: (#\w+);\s+--tone-5: (#\w+);/g,
  ),
].map((m) => m.slice(1));

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function hueAndSaturation(hex: string) {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  const hue =
    delta === 0
      ? 0
      : max === r
        ? ((g - b) / delta + 6) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  return { hue: hue * 60, saturation: delta / (1 - Math.abs(max + max - delta - 1)) };
}

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = channels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("tone colours", () => {
  it("are defined for the light theme and both dark ones, which match", () => {
    expect(palettes).toHaveLength(3);
    expect(palettes[2]).toEqual(palettes[1]);
  });

  it.each(["light", "dark"].map((theme, i) => [theme, i] as const))(
    "follow the agreed code in the %s theme",
    (_, i) => {
      const [first, second, third, fourth, neutral] = palettes[i].map(hueAndSaturation);
      expect(first.hue).toBeGreaterThan(200);
      expect(first.hue).toBeLessThan(250);
      expect(second.hue).toBeGreaterThan(90);
      expect(second.hue).toBeLessThan(170);
      expect(third.hue).toBeGreaterThan(40);
      expect(third.hue).toBeLessThan(65);
      expect(Math.min(fourth.hue, 360 - fourth.hue)).toBeLessThan(15);
      expect(neutral.saturation).toBeLessThan(0.2);
    },
  );

  it.each([
    ["light", 0, "#ffffff"],
    ["dark", 1, "#1b1d21"],
  ] as const)("stay readable on the %s surface", (_, i, surface) => {
    for (const color of palettes[i]) expect(contrast(color, surface), color).toBeGreaterThan(2.5);
  });
});
