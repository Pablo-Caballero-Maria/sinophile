import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readDataDir } from "../../scripts/data-files";
import { sanitizeLessons } from "./data/validate";
import { HOMOGRAPHS, HSK, hskPieces, hskSummary, percent, posLabel } from "./hsk";
import type { VocabEntry } from "./types";

const raw = readDataDir(fileURLToPath(new URL("../../data", import.meta.url)));
const vocab = sanitizeLessons({
  lessons: raw.lessons.map(({ folder, vocab }) => ({ folder, vocab })),
  ignored: raw.ignored,
}).entries;

describe("HSK 2 list of HSK 3.0 (data/hsk2.json)", () => {
  it("has the 500 words of the 2025 syllabus: 300 of level 1 and 200 of level 2", () => {
    expect(HSK).toHaveLength(500);
    expect(HSK.filter((w) => w.level === 1)).toHaveLength(300);
    expect(HSK.filter((w) => w.level === 2)).toHaveLength(200);
    for (const w of HSK) expect(w.pinyin, w.hanzi).toMatch(/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü' /]+$/i);
    expect(HSK.find((w) => w.hanzi === "谁")?.pinyin).toBe("shéi/shuí"); // both readings, as in the syllabus
    expect(HSK.find((w) => w.hanzi === "都")?.pinyin).toBe("dōu");
    expect(HSK.find((w) => w.hanzi === "爸爸")).toMatchObject({ pinyin: "bàba", level: 1, pos: "名" });
  });

  it("tells apart the words written alike by their part of speech", () => {
    expect([...HOMOGRAPHS].sort()).toEqual(["点", "花", "过"].sort());
    const flower = HSK.filter((w) => w.hanzi === "花").map((w) => posLabel(w.pos));
    expect(flower.sort()).toEqual(["sustantivo", "verbo"]);
    expect(posLabel("量、（名）")).toBe("clasificador");
    expect(posLabel("后缀、（动、名、量）")).toBe("sufijo");
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
    const list = [...hsk].map((hanzi) => ({ hanzi }));
    const summary = hskSummary(
      [
        word("benshu", "本书"),
        word("jian", "件衣服"),
        word("yiyue", "一月"),
        word("yi", "一"),
        word("mao", "猫"),
      ],
      list,
    );
    expect(summary.hskWords.map((w) => w.id)).toEqual(["benshu", "yiyue", "yi"]);
    expect([...summary.known.keys()].sort()).toEqual(["一", "书", "月", "本", "衣服"].sort());
    expect(summary.known.get("一")?.id).toBe("yi");
    expect(summary.known.get("书")?.id).toBe("benshu");
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });

  it("matches the real vocabulary sensibly", () => {
    const { hskWords, known } = hskSummary(vocab);
    for (const hanzi of ["书", "本", "月", "衣服", "杯子", "星期", "朋友", "家", "椅子", "工作"])
      expect(known.has(hanzi), hanzi).toBe(true);
    for (const hanzi of ["出租车", "医生"]) expect(known.has(hanzi), hanzi).toBe(false);
    const ids = hskWords.map((w) => w.id);
    expect(ids).toEqual(
      expect.arrayContaining(["benshu", "xingqiyi", "yiyue", "bei", "pengyou", "nanpengyou", "jianyifu"]),
    );
    // 西班牙, the shades of colour and 栋 aren't in the list.
    for (const id of ["xibanya", "qianlanse", "donglou"]) expect(ids).not.toContain(id);
    expect(known.get("朋友")?.id).toBe("pengyou");
  });
});
