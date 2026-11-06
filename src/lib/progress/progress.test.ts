import { describe, expect, it } from "vitest";
import { diffProgress, emptyProgress, isEmptyProgress, mergeProgress, recordAnswer, recordPractice, recordSession, reviveProgress, streakInfo } from "./model";

describe("reviveProgress (untrusted JSON)", () => {
  it("keeps valid data and drops malformed entries and unsafe keys", () => {
    const p = reviveProgress({
      updatedAt: "2026-11-04T10:00:00.000Z",
      days: { "2026-11-04": { xp: 30, answered: 3, correct: "x", sessions: 1, ms: -5 }, "$where": { xp: 1 }, "2026-11-05": 7 },
      items: {
        "ni:meaning": { b: 9, d: "2026-11-05", s: 2, c: 1, t: 5 },
        "a.b:meaning": { b: 1, d: "2026-11-05", s: 1, c: 1, t: 1 },
        "ni:dancing": { b: 1, d: "2026-11-05", s: 1, c: 1, t: 1 },
        "wo:pinyin": { b: 1, d: "mañana" },
      },
      lessons: { "1": { sessions: 2, best: 140, last: "2026-11-04" }, "x$": { sessions: 1, best: 1, last: "2026-11-04" } },
      exams: [{ id: "exam-1", date: "2026-11-04T10:00:00Z", lessons: ["1", 4], total: 10, correct: 8, grade: 8, ms: 1000 }, { id: 3 }],
      records: { infinite: 12, combo: "lots" },
      achievements: { "first-session": "2026-11-04T10:00:00Z", "bad.key": "x" },
      extra: "ignored",
    });
    expect(p.days).toEqual({ "2026-11-04": { xp: 30, answered: 3, correct: 0, sessions: 1, ms: 0 } });
    expect(p.items).toEqual({ "ni:meaning": { b: 6, d: "2026-11-05", s: 2, c: 1, t: 5 } });
    expect(p.lessons).toEqual({ "1": { sessions: 2, best: 100, last: "2026-11-04" } });
    expect(p.exams).toEqual([{ id: "exam-1", date: "2026-11-04T10:00:00Z", lessons: ["1"], total: 10, correct: 8, grade: 8, ms: 1000 }]);
    expect(p.records).toEqual({ infinite: 12, combo: 0 });
    expect(p.achievements).toEqual({ "first-session": "2026-11-04T10:00:00Z" });
    expect(p).not.toHaveProperty("extra");
  });

  it("never throws", () => {
    for (const junk of [null, 3, "x", [], { days: [], items: "no" }]) expect(reviveProgress(junk)).toEqual(emptyProgress());
  });
});

describe("ungraded practice", () => {
  it("counts for the day's XP and the streak, but not as an answer or for spaced repetition", () => {
    const p = recordPractice(recordPractice(emptyProgress(), 5, "2026-11-06"), 5, "2026-11-06");
    expect(p.days["2026-11-06"]).toEqual({ xp: 10, answered: 0, correct: 0, sessions: 0, ms: 0 });
    expect(p.items).toEqual({});
    expect(streakInfo(p, "2026-11-06").practicedToday).toBe(true);
  });
});

describe("partial saves", () => {
  it("diffProgress contains only what changed, and merging it reproduces the new state", () => {
    let before = emptyProgress();
    for (const id of ["ni", "wo", "ta"]) before = recordAnswer(before, id, "meaning", true, 10, "2026-11-03");
    let after = recordAnswer(before, "ni", "pinyin", false, 0, "2026-11-04");
    after = recordSession(after, { lessonId: "1", accuracy: 50, ms: 1000, xpBonus: 5, maxCombo: 3, exam: { id: "e1", date: "2026-11-04", lessons: [], total: 2, correct: 1, grade: 5, ms: 1 } }, "2026-11-04");
    const patch = diffProgress(before, after);
    expect(Object.keys(patch.items)).toEqual(["ni:pinyin"]);
    expect(Object.keys(patch.days)).toEqual(["2026-11-04"]);
    expect(Object.keys(patch.lessons)).toEqual(["1"]);
    expect(patch.exams.map((e) => e.id)).toEqual(["e1"]);
    expect(mergeProgress(before, patch)).toEqual(after);
    expect(isEmptyProgress(diffProgress(after, after))).toBe(false); // records are always sent
    expect(Object.keys(diffProgress(after, after).items)).toEqual([]);
  });

  it("isEmptyProgress", () => {
    expect(isEmptyProgress(emptyProgress())).toBe(true);
    expect(isEmptyProgress(recordAnswer(emptyProgress(), "ni", "meaning", true, 10))).toBe(false);
  });
});
