import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gradeDrawing, mediansToScreen, strokePath, type Point } from "./drawing";
import { indexVocab, search } from "./dictionary";
import { VOCAB } from "./data/vocab";

const strokes = (char: string) =>
  JSON.parse(readFileSync(new URL(`../../node_modules/hanzi-writer-data/${char}.json`, import.meta.url), "utf8")) as { medians: number[][][] };

/** Simulates a learner drawing the medians in a 300px canvas, optionally shrunk/shifted. */
const drawLike = (medians: number[][][], scale = 1, dx = 0): Point[][] =>
  mediansToScreen(medians).map((stroke) => stroke.map((p) => ({ x: ((p.x * scale) / 1024) * 300 + dx, y: ((p.y * scale) / 1024) * 300 })));

describe("drawing preview path", () => {
  it("draws nothing without points and a dot for a single point", () => {
    expect(strokePath([])).toBe("");
    expect(strokePath([{ x: 3, y: 4 }])).toBe("M3 4L3 4");
  });

  it("smooths through midpoints, like the canvas", () => {
    expect(strokePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }])).toBe("M0 0Q0 0 5 0Q10 0 10 10");
  });
});

describe("free drawing grade", () => {
  it("accepts a faithful drawing, even if small and off-centre", () => {
    const { medians } = strokes("我");
    expect(gradeDrawing(drawLike(medians), 300, medians).passed).toBe(true);
    expect(gradeDrawing(drawLike(medians, 0.6, 40), 300, medians).passed).toBe(true);
  });

  it("rejects wrong stroke order, reversed strokes and scribbles", () => {
    const { medians } = strokes("你");
    const drawn = drawLike(medians);
    expect(gradeDrawing([...drawn].reverse(), 300, medians).passed).toBe(false);
    expect(gradeDrawing(drawn.map((s) => [...s].reverse()), 300, medians).passed).toBe(false);
    const scribble = [[{ x: 10, y: 10 }, { x: 290, y: 290 }]];
    expect(gradeDrawing(scribble, 300, medians).passed).toBe(false);
    expect(gradeDrawing([], 300, medians).score).toBe(0);
  });
});

describe("dictionary search", () => {
  const items = indexVocab(VOCAB);
  it("finds by hanzi, pinyin (any notation) and Spanish", () => {
    expect(search(items, "老师")[0].hanzi).toBe("老师");
    expect(search(items, "laoshi")[0].hanzi).toBe("老师");
    expect(search(items, "lao3shi1")[0].hanzi).toBe("老师");
    expect(search(items, "profesor")[0].hanzi).toBe("老师");
    expect(search(items, "espanol")[0].hanzi).toBe("西班牙语");
    expect(search(items, "ta").map((e) => e.hanzi)).toEqual(expect.arrayContaining(["他", "她"]));
  });
});
