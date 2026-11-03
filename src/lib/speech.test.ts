import { describe, expect, it } from "vitest";
import { scorePronunciation } from "./speech";

describe("pronunciation scoring", () => {
  it("gives full marks for an exact transcript", async () => {
    expect((await scorePronunciation("你好", ["你好"])).score).toBe(1);
    expect((await scorePronunciation("你好，老师！", ["你好老师"])).score).toBe(1);
  });
  it("uses the best alternative and partial syllable overlap", async () => {
    const s = await scorePronunciation("我是学生", ["我是老师", "我是学生"]);
    expect(s.score).toBe(1);
    expect(s.heard).toBe("我是学生");
    const partial = await scorePronunciation("我是学生", ["我是老师"]);
    expect(partial.score).toBeCloseTo(0.5);
    // homophones count as correct pronunciation (他/她 both tā)
    expect((await scorePronunciation("她", ["他"])).score).toBe(1);
  });
  it("handles silence", async () => {
    expect((await scorePronunciation("你好", [])).score).toBe(0);
  });
});
