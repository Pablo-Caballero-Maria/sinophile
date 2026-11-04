import { describe, expect, it } from "vitest";
import { canonicalPinyin, charTones, markSyllable, numberedToMarked, pinyinEquals, prettifyTyped, splitSyllables, stripTones, toneOf, toneVariants } from "./pinyin";
import { seededRandom } from "./text";
import { VOCAB } from "./data/vocab";

describe("pinyin", () => {
  it("places tone marks by the standard rules", () => {
    expect(markSyllable("hao", 3)).toBe("hǎo");
    expect(markSyllable("dou", 1)).toBe("dōu");
    expect(markSyllable("gui", 4)).toBe("guì");
    expect(markSyllable("lv", 3)).toBe("lǚ");
    expect(markSyllable("ma", 5)).toBe("ma");
  });

  it("converts numbered pinyin, joining words with apostrophes when needed", () => {
    expect(numberedToMarked("ni3 hao3")).toBe("nǐ hǎo");
    expect(numberedToMarked("Zhong1 guo2", true)).toBe("Zhōngguó");
    expect(numberedToMarked("Xi1 an1", true)).toBe("Xī'ān");
    expect(numberedToMarked("nu:3 hai2", true)).toBe("nǚhái");
  });

  it("compares tolerant of spacing, case and tone notation", () => {
    expect(pinyinEquals("lao3shi1", "lǎoshī")).toBe(true);
    expect(pinyinEquals("Lǎo shī", "lǎoshī")).toBe(true);
    expect(pinyinEquals("peng2you5", "péngyou")).toBe(true);
    expect(pinyinEquals("peng2you", "péngyou")).toBe(true);
    expect(pinyinEquals("nv3hai2", "nǚhái")).toBe(true);
    expect(pinyinEquals("lao2shi1", "lǎoshī")).toBe(false);
    expect(pinyinEquals("lao2shi1", "lǎoshī", true)).toBe(true);
    expect(pinyinEquals("nu3hai2", "nǚhái")).toBe(false);
  });

  it("strips tones and reads tones", () => {
    expect(stripTones("Xībānyáyǔ")).toBe("Xibanyayu");
    expect(toneOf("shī")).toBe(1);
    expect(toneOf("you")).toBe(5);
    expect(canonicalPinyin("nǐ hǎo")).toEqual({ letters: "nihao", tones: [3, 3] });
  });

  it("splits syllables for every word of the real vocabulary", () => {
    for (const w of VOCAB) expect(charTones(w.hanzi, w.pinyin), `${w.hanzi} ${w.pinyin}`).not.toBeNull();
    expect(splitSyllables("Xībānyáyǔ").map((s) => s.text)).toEqual(["Xī", "bān", "yá", "yǔ"]);
    expect(splitSyllables("dàngāo").map((s) => s.text)).toEqual(["dàn", "gāo"]);
    expect(charTones("朋友", "péngyou")).toEqual([2, 5]);
  });

  it("aligns erhua (儿 merged into the previous syllable)", () => {
    expect(charTones("这儿", "zhèr")).toEqual([4, 4]);
    expect(charTones("这儿有猫", "zhèr yǒu māo")).toEqual([4, 4, 3, 1]);
    expect(charTones("女儿", "nǚ'ér")).toEqual([3, 2]);
    expect(charTones("儿", "ér")).toEqual([2]);
    expect(charTones("这儿", "zhè")).toBeNull();
    expect(charTones("你好", "nǐ")).toBeNull();
  });

  it("generates distinct tone variants", () => {
    const variants = toneVariants("nǐ hǎo", 3, seededRandom(1));
    expect(variants).toHaveLength(3);
    expect(new Set(variants).size).toBe(3);
    expect(variants).not.toContain("nǐ hǎo");
    variants.forEach((v) => expect(stripTones(v)).toBe("ni hao"));
    expect(toneVariants("shì", 3, seededRandom(2))).toHaveLength(3);
  });

  it("prettifies typed numbered pinyin", () => {
    expect(prettifyTyped("ni3 hao3")).toBe("nǐ hǎo");
  });
});
