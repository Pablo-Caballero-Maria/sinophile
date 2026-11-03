import { describe, expect, it } from "vitest";
import rawExercises from "@data/exercises.json";
import rawVocab from "@data/vocab.json";
import { sanitizeExercises, sanitizeVocab } from "../data/validate";
import { emptyProgress, recordAnswer } from "../progress/model";
import { seededRandom } from "../text";
import { buildSession, nextInfinite, type GenContext } from "./generate";
import { checkChoice, checkTiles, checkTyping } from "./check";
import { initialSession, sessionReducer, examGrade } from "./session";
import type { Exercise, SessionMode } from "./types";

const vocab = sanitizeVocab(rawVocab);
const exercises = sanitizeExercises(rawExercises, vocab.entries);
const ctx = (seed = 1, progress = emptyProgress()): GenContext => ({
  vocab: vocab.entries,
  sets: exercises.file.words,
  progress,
  showPinyin: true,
  speaking: true,
  sessionLength: 15,
  random: seededRandom(seed),
  today: "2026-11-03",
});

describe("data files", () => {
  it("vocab.json and exercises.json are valid and complete", () => {
    expect(vocab.issues).toEqual([]);
    expect(exercises.issues.filter((i) => i.level !== "info")).toEqual([]);
    expect(exercises.missing).toEqual([]);
  });

  it("every curated sentence only uses known vocabulary or punctuation", () => {
    const known = new Set(vocab.entries.map((v) => v.hanzi));
    for (const [id, set] of Object.entries(exercises.file.words)) {
      for (const s of set.examples) {
        for (const token of s.zh) expect(known.has(token) || /^[，。！？、]$/.test(token), `${id}: ${token}`).toBe(true);
      }
    }
  });

  it("reports invalid data instead of crashing", () => {
    const bad = sanitizeVocab([{ id: "x", hanzi: "abc", pinyin: "a", es: "b", lesson: "2026-1-1" }, 3, { id: "ni", hanzi: "你" }]);
    expect(bad.entries).toEqual([]);
    expect(bad.issues).toHaveLength(3);
    const badEx = sanitizeExercises({ words: { ni: { examples: [{ zh: ["你"], pinyin: "nǐ", es: "tú" }], exercises: [{ type: "fill", example: 5 }, { type: "nope" }] } } }, vocab.entries);
    expect(badEx.file.words.ni.exercises).toEqual([]);
    expect(badEx.issues.filter((i) => i.level === "error")).toHaveLength(2);
  });
});

/** Structural sanity of an exercise. */
function assertValid(ex: Exercise) {
  expect(ex.wordIds.length).toBeGreaterThan(0);
  expect(ex.instruction).toBeTruthy();
  if (ex.type === "choice") {
    expect(ex.options.length).toBeGreaterThanOrEqual(2);
    expect(ex.options.map((o) => o.id)).toContain(ex.answerId);
    expect(new Set(ex.options.map((o) => o.display.text)).size).toBe(ex.options.length);
  }
  if (ex.type === "tiles") {
    // the solution must be buildable from the tiles (backtracking: 西班牙 vs 西班牙语)
    const buildable = (rest: string, tiles: string[]): boolean =>
      rest === "" || tiles.some((t, i) => rest.startsWith(t) && buildable(rest.slice(t.length), tiles.filter((_, j) => j !== i)));
    if (ex.lang === "zh") expect(buildable(ex.answers[0], ex.tiles), `${ex.solution} from ${ex.tiles}`).toBe(true);
  }
  if (ex.type === "match") expect(ex.pairs.length).toBeGreaterThanOrEqual(3);
}

describe("session generation", () => {
  const modes: SessionMode[] = ["leccion", "repaso", "examen", "escritura", "tarjetas", "escucha", "pronunciacion", "tonos", "frases", "infinito"];
  it.each(modes)("builds a valid %s session", (mode) => {
    // a bit of history so review mode has due items
    let progress = emptyProgress();
    for (const w of vocab.entries.slice(0, 8)) progress = recordAnswer(progress, w.id, "meaning", true, 10, "2026-11-01");
    for (let seed = 1; seed <= 20; seed++) {
      const list = buildSession({ mode, lessons: [], words: [] }, vocab.entries, ctx(seed, progress));
      expect(list.length, mode).toBeGreaterThan(0);
      list.forEach(assertValid);
    }
  });

  it("introduces unseen words in a first lesson", () => {
    const list = buildSession({ mode: "leccion", lessons: [], words: [] }, vocab.entries, ctx());
    expect(list[0].type).toBe("intro");
    expect(list.length).toBeGreaterThanOrEqual(12);
    expect(list.length).toBeLessThanOrEqual(18);
  });

  it("infinite mode keeps producing exercises", () => {
    const c = ctx(7);
    for (let i = 0; i < 100; i++) assertValid(nextInfinite(vocab.entries, c));
  });
});

describe("answer checking", () => {
  const c = ctx(3);
  const all = vocab.entries.flatMap((w) => buildSession({ mode: "frases", lessons: [], words: [w.id] }, [w], c));

  it("accepts the solution of every tiles exercise", () => {
    for (const ex of all) {
      if (ex.type !== "tiles") continue;
      const tokens = ex.lang === "zh" ? [ex.solution] : ex.solution.split(" ");
      expect(checkTiles(ex, tokens).correct, ex.solution).toBe(true);
      expect(checkTiles(ex, ex.lang === "zh" ? [ex.solution.slice(1)] : tokens.slice(0, -1)).correct).toBe(false);
    }
  });

  it("checks typed pinyin and Spanish leniently", () => {
    const [w] = vocab.entries.filter((v) => v.id === "laoshi");
    const pin = buildSession({ mode: "tonos", lessons: [], words: [] }, [w], c).find((e) => e.type === "typing");
    const typing: Extract<Exercise, { type: "typing" }> = pin?.type === "typing" ? pin : { key: "k", skill: "pinyin", wordIds: [w.id], instruction: "x", type: "typing", prompt: { kind: "text", text: "" }, mode: "pinyin", answers: [w.pinyin], solution: w.pinyin };
    expect(checkTyping(typing, "lao3 shi1").correct).toBe(true);
    const wrongTone = checkTyping(typing, "lao2shi1");
    expect(wrongTone.correct).toBe(false);
    expect(wrongTone.note).toMatch(/tonos/);
    const es: typeof typing = { ...typing, mode: "es", answers: ["compañero de clase"], solution: "compañero de clase" };
    expect(checkTyping(es, "el compañero de clase").correct).toBe(true);
    expect(checkTyping(es, "companero de clase").correct).toBe(true);
    expect(checkTyping(es, "compañro de clase").correct).toBe(true);
    expect(checkTyping(es, "amigo").correct).toBe(false);
  });

  it("checks choices", () => {
    const ex = all.find((e) => e.type === "choice");
    if (ex?.type !== "choice") throw new Error("no choice exercise");
    expect(checkChoice(ex, ex.answerId).correct).toBe(true);
    expect(checkChoice(ex, ex.options.find((o) => o.id !== ex.answerId)!.id).correct).toBe(false);
  });
});

describe("session state machine", () => {
  const list = buildSession({ mode: "tonos", lessons: [], words: [] }, vocab.entries, ctx(5));

  it("re-queues a wrong answer once in learning modes and awards XP", () => {
    let s = initialSession("leccion", list.slice(0, 2));
    s = sessionReducer(s, { type: "answer", result: { correct: false } });
    expect(s.queue).toHaveLength(3);
    s = sessionReducer(s, { type: "next" });
    s = sessionReducer(s, { type: "answer", result: { correct: true } });
    expect(s.xp).toBe(10);
    s = sessionReducer(s, { type: "next" });
    s = sessionReducer(s, { type: "answer", result: { correct: true } }); // retry
    expect(s.xp).toBe(15);
    s = sessionReducer(s, { type: "next" });
    expect(s.phase).toBe("done");
  });

  it("ends infinite mode after three mistakes", () => {
    let s = initialSession("infinito", [list[0]]);
    for (let i = 0; i < 3; i++) {
      s = sessionReducer(s, { type: "answer", result: { correct: false } });
      s = sessionReducer(s, { type: "next", more: list[i + 1] ?? list[0] });
    }
    expect(s.phase).toBe("done");
    expect(s.lives).toBe(0);
  });

  it("grades exams on the Spanish 0-10 scale without feedback", () => {
    let s = initialSession("examen", list.slice(0, 4));
    for (const ok of [true, true, true, false]) s = sessionReducer(s, { type: "answer", result: { correct: ok } });
    expect(s.phase).toBe("done");
    expect(examGrade(s)).toBe(7.5);
  });
});
