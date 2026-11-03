import { describe, expect, it } from "vitest";
import { review } from "./srs";
import { addDays, daysBetween, normalizeLatin, normalizeZh, splitMeanings, spanishWords } from "./text";
import { emptyProgress, levelInfo, mergeProgress, recordAnswer, recordSession, streakInfo, totalXp, lessonStars, dueItems } from "./progress/model";
import { LESSONS, VOCAB } from "./data/vocab";

describe("text helpers", () => {
  it("normalises Spanish and Chinese", () => {
    expect(normalizeLatin("¡Hola, Él es Compañero!")).toBe("hola el es companero");
    expect(normalizeZh("你好，老师！")).toBe("你好老师");
    expect(splitMeanings("amigo / amiga; colega (informal)")).toEqual(["amigo", "amiga", "colega"]);
    expect(spanishWords("¿Eres estudiante?")).toEqual(["Eres", "estudiante"]);
  });
  it("does date arithmetic across months", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(daysBetween("2026-11-03", "2026-11-10")).toBe(7);
  });
});

describe("spaced repetition", () => {
  it("promotes on correct answers and demotes on mistakes", () => {
    let s = review(undefined, true, "2026-11-03");
    expect(s.b).toBe(1);
    expect(s.d).toBe("2026-11-04");
    s = review(s, true, "2026-11-03"); // not due, but still learning -> promoted
    expect(s.b).toBe(2);
    s = review(s, true, "2026-11-03"); // not due and past learning boxes -> stays
    expect(s.b).toBe(2);
    s = review(s, true, "2026-11-05"); // due -> promoted
    expect(s.b).toBe(3);
    s = review(s, false, "2026-11-05");
    expect(s.b).toBe(1);
    expect(s.d).toBe("2026-11-05");
    expect(s.s).toBe(5);
    expect(s.c).toBe(4);
  });
});

describe("progress model", () => {
  it("derives XP, level and streak from days", () => {
    let p = emptyProgress();
    p = recordAnswer(p, "ni", "meaning", true, 10, "2026-11-01");
    p = recordAnswer(p, "ni", "meaning", true, 10, "2026-11-02");
    p = recordAnswer(p, "wo", "meaning", false, 0, "2026-11-03");
    p = recordSession(p, { accuracy: 50, ms: 1000, xpBonus: 90, maxCombo: 2, lessonId: "2026-11-03" }, "2026-11-03");
    expect(totalXp(p)).toBe(110);
    expect(levelInfo(110).level).toBe(2);
    expect(streakInfo(p, "2026-11-03")).toEqual({ current: 3, best: 3, practicedToday: true });
    expect(streakInfo(p, "2026-11-04").current).toBe(3); // today not practised yet: streak still alive
    expect(streakInfo(p, "2026-11-05").current).toBe(0);
    expect(p.lessons["2026-11-03"].sessions).toBe(1);
  });

  it("merges two devices without losing work", () => {
    const base = recordAnswer(emptyProgress(), "ni", "meaning", true, 10, "2026-11-01");
    const a = recordAnswer(base, "wo", "meaning", true, 10, "2026-11-02");
    const b = { ...recordAnswer(base, "ta-m", "pinyin", true, 10, "2026-11-02"), achievements: { "first-session": "2026-11-01T00:00:00Z" } };
    const merged = mergeProgress(a, b);
    expect(Object.keys(merged.items).sort()).toEqual(["ni:meaning", "ta-m:pinyin", "wo:meaning"]);
    expect(merged.days["2026-11-02"].xp).toBe(10);
    expect(merged.achievements["first-session"]).toBeDefined();
    expect(mergeProgress(merged, merged)).toEqual(merged);
  });

  it("computes stars and due items for the real lesson", () => {
    const lesson = LESSONS[0];
    let p = emptyProgress();
    expect(lessonStars(p, lesson)).toBe(0);
    for (const w of lesson.words) p = recordAnswer(p, w.id, "meaning", true, 10, "2026-11-03");
    expect(lessonStars(p, lesson)).toBe(1);
    expect(dueItems(p, new Set(VOCAB.map((v) => v.id)), "2026-11-03")).toHaveLength(0);
    expect(dueItems(p, new Set(VOCAB.map((v) => v.id)), "2026-11-04")).toHaveLength(lesson.words.length);
  });
});
