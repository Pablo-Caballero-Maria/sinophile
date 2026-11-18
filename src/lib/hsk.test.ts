import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readDataDir } from "../../scripts/data-files";
import { sanitizeLessons } from "./data/validate";
import { HSK1, hskPieces, hskSummary, percent } from "./hsk";
import type { VocabEntry } from "./types";

const raw = readDataDir(fileURLToPath(new URL("../../data", import.meta.url)));
const vocab = sanitizeLessons({ lessons: raw.lessons.map(({ folder, vocab }) => ({ folder, vocab })), ignored: raw.ignored }).entries;

describe("HSK 1 list (data/hsk1.json)", () => {
  it("has the 150 words of HSK 1, once each, with pinyin", () => {
    expect(HSK1).toHaveLength(150);
    expect(new Set(HSK1.map((w) => w.hanzi)).size).toBe(150);
    for (const w of HSK1) expect(w.pinyin, w.hanzi).toMatch(/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü']+$/i);
    expect(HSK1.find((w) => w.hanzi === "都")?.pinyin).toBe("dōu");
    expect(HSK1.find((w) => w.hanzi === "钱")?.pinyin).toBe("qián");
  });
});

describe("HSK coverage", () => {
  const hsk = new Set(["本", "书", "衣服", "一", "月", "星期", "杯子", "大", "家", "好"]);

  it("splits words into HSK words, covering as much as possible", () => {
    expect(hskPieces("本书", hsk)).toEqual({ pieces: ["本", "书"], complete: true });
    expect(hskPieces("星期一", hsk)).toEqual({ pieces: ["星期", "一"], complete: true });
    expect(hskPieces("件衣服", hsk)).toEqual({ pieces: ["衣服"], complete: false });
    expect(hskPieces("杯", hsk)).toEqual({ pieces: ["杯子"], complete: true });
    expect(hskPieces("猫", hsk)).toEqual({ pieces: [], complete: false });
  });

  it("counts your HSK words and the HSK words you know, preferring the word itself", () => {
    const word = (id: string, hanzi: string): VocabEntry => ({ id, hanzi, pinyin: "", es: "", lesson: "1" });
    const list = [...hsk].map((hanzi) => ({ hanzi, pinyin: "" }));
    const summary = hskSummary([word("benshu", "本书"), word("jian", "件衣服"), word("yiyue", "一月"), word("yi", "一"), word("mao", "猫")], list);
    expect(summary.hskWords.map((w) => w.id)).toEqual(["benshu", "yiyue", "yi"]);
    expect([...summary.known.keys()].sort()).toEqual(["一", "书", "月", "本", "衣服"].sort());
    expect(summary.known.get("一")?.id).toBe("yi");
    expect(summary.known.get("书")?.id).toBe("benshu");
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });

  it("matches the real vocabulary sensibly", () => {
    const { hskWords, known } = hskSummary(vocab);
    for (const hanzi of ["书", "本", "月", "衣服", "杯子", "星期", "朋友", "家", "椅子", "工作"]) expect(known.has(hanzi), hanzi).toBe(true);
    for (const hanzi of ["睡觉", "很", "出租车"]) expect(known.has(hanzi), hanzi).toBe(false);
    const ids = hskWords.map((w) => w.id);
    expect(ids).toEqual(expect.arrayContaining(["benshu", "xingqiyi", "yiyue", "bei", "pengyou"]));
    expect(ids).not.toContain("nanpengyou");
    expect(ids).not.toContain("jianyifu");
    expect(known.get("朋友")?.id).toBe("pengyou");
  });
});
