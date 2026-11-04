import { describe, expect, it } from "vitest";
import { upgradeLegacyProgress } from "../account/legacy";
import { diffProgress, emptyProgress, isEmptyProgress, mergeProgress, recordAnswer, recordSession, reviveProgress } from "./model";

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
      lessons: { "2026-10-26": { sessions: 2, best: 140, last: "2026-11-04" }, "x$": { sessions: 1, best: 1, last: "2026-11-04" } },
      exams: [{ id: "exam-1", date: "2026-11-04T10:00:00Z", lessons: ["2026-10-26", 4], total: 10, correct: 8, grade: 8, ms: 1000 }, { id: 3 }],
      records: { infinite: 12, combo: "lots" },
      achievements: { "first-session": "2026-11-04T10:00:00Z", "bad.key": "x" },
      extra: "ignored",
    });
    expect(p.days).toEqual({ "2026-11-04": { xp: 30, answered: 3, correct: 0, sessions: 1, ms: 0 } });
    expect(p.items).toEqual({ "ni:meaning": { b: 6, d: "2026-11-05", s: 2, c: 1, t: 5 } });
    expect(p.lessons).toEqual({ "2026-10-26": { sessions: 2, best: 100, last: "2026-11-04" } });
    expect(p.exams).toEqual([{ id: "exam-1", date: "2026-11-04T10:00:00Z", lessons: ["2026-10-26"], total: 10, correct: 8, grade: 8, ms: 1000 }]);
    expect(p.records).toEqual({ infinite: 12, combo: 0 });
    expect(p.achievements).toEqual({ "first-session": "2026-11-04T10:00:00Z" });
    expect(p).not.toHaveProperty("extra");
  });

  it("never throws", () => {
    for (const junk of [null, 3, "x", [], { days: [], items: "no" }]) expect(reviveProgress(junk)).toEqual(emptyProgress());
  });
});

describe("partial saves", () => {
  it("diffProgress contains only what changed, and merging it reproduces the new state", () => {
    let before = emptyProgress();
    for (const id of ["ni", "wo", "ta"]) before = recordAnswer(before, id, "meaning", true, 10, "2026-11-03");
    let after = recordAnswer(before, "ni", "pinyin", false, 0, "2026-11-04");
    after = recordSession(after, { lessonId: "2026-10-26", accuracy: 50, ms: 1000, xpBonus: 5, maxCombo: 3, exam: { id: "e1", date: "2026-11-04", lessons: [], total: 2, correct: 1, grade: 5, ms: 1 } }, "2026-11-04");
    const patch = diffProgress(before, after);
    expect(Object.keys(patch.items)).toEqual(["ni:pinyin"]);
    expect(Object.keys(patch.days)).toEqual(["2026-11-04"]);
    expect(Object.keys(patch.lessons)).toEqual(["2026-10-26"]);
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

describe("legacy (first version) progress", () => {
  it("moves the stats of the lesson once dated 2026-11-03 to 2026-10-26", () => {
    const old = recordSession(emptyProgress(), { lessonId: "2026-11-03", accuracy: 90, ms: 1, xpBonus: 0, maxCombo: 1, exam: { id: "e", date: "d", lessons: ["2026-11-03"], total: 1, correct: 1, grade: 10, ms: 1 } }, "2026-11-03");
    const upgraded = upgradeLegacyProgress(old);
    expect(Object.keys(upgraded.lessons)).toEqual(["2026-10-26"]);
    expect(upgraded.exams[0].lessons).toEqual(["2026-10-26"]);
    expect(upgraded.days).toEqual(old.days); // days are calendar days, not lessons
  });
});
