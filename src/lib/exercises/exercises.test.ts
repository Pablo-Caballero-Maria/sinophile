import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readDataDir } from "../../../scripts/data-files";
import { sanitizeAllExercises, sanitizeLessons } from "../data/validate";
import { emptyProgress, recordAnswer } from "../progress/model";
import { seededRandom } from "../text";
import {
  buildSession,
  drillFor,
  meaningChoice,
  nextInfinite,
  reverseChoice,
  type GenContext,
} from "./generate";
import { checkChoice, checkTiles, checkTyping } from "./check";
import { accuracy, initialSession, PRACTICE_XP, sessionReducer, examGrade } from "./session";
import { reviewable } from "./silent";
import type { Exercise, SessionMode } from "./types";

const raw = readDataDir(fileURLToPath(new URL("../../../data", import.meta.url)));
const vocab = sanitizeLessons({
  lessons: raw.lessons.map(({ folder, vocab }) => ({ folder, vocab })),
  ignored: raw.ignored,
});
const exercises = sanitizeAllExercises(
  Object.fromEntries(raw.lessons.map((l) => [l.folder, l.exercises])),
  vocab.lessons,
);
const ctx = (seed = 1, progress = emptyProgress()): GenContext => ({
  vocab: vocab.entries,
  sets: exercises.file.words,
  progress,
  showPinyin: true,
  speaking: true,
  silent: false,
  sessionLength: 15,
  random: seededRandom(seed),
  today: "2026-11-03",
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
      rest === "" ||
      tiles.some(
        (t, i) =>
          rest.startsWith(t) &&
          buildable(
            rest.slice(t.length),
            tiles.filter((_, j) => j !== i),
          ),
      );
    if (ex.lang === "zh")
      expect(buildable(ex.answers[0], ex.tiles), `${ex.solution} from ${ex.tiles}`).toBe(true);
  }
  if (ex.type === "match") expect(ex.pairs.length).toBeGreaterThanOrEqual(3);
}

describe("session generation", () => {
  const modes: SessionMode[] = [
    "leccion",
    "repaso",
    "examen",
    "escritura",
    "tarjetas",
    "escucha",
    "pronunciacion",
    "tonos",
    "frases",
    "infinito",
  ];
  it.each(modes)("builds a valid %s session", (mode) => {
    // a bit of history so review mode has due items
    let progress = emptyProgress();
    for (const w of vocab.entries.slice(0, 8))
      progress = recordAnswer(progress, w.id, "meaning", true, 10, "2026-11-01");
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

  it("never offers a word with a shared meaning as a wrong option (孩子/子女, 男孩/男孩子, 星期/周, 日/号)", () => {
    const byId = new Map(vocab.entries.map((w) => [w.id, w]));
    const pairs = [
      ["haizi", "zinv"],
      ["zinv", "haizi"],
      ["nanhaizi", "nanhaizi-informal"],
      ["zhongwen", "zhongguoren"],
      ["xibanyayu", "xibanyaren"],
      ["xibanyaren", "xibanyayu"],
    ];
    pairs.push(
      ["xingqi", "zhou"],
      ["zhou", "xingqi"],
      ["ri", "hao"],
      ["hao", "ri"],
      ["shenme", "na-cual"],
      ["na-cual", "shenme"],
    );
    for (const [id, other] of pairs) {
      for (let seed = 1; seed <= 60; seed++) {
        for (const ex of [meaningChoice(byId.get(id)!, ctx(seed)), reverseChoice(byId.get(id)!, ctx(seed))]) {
          if (ex.type === "choice")
            expect(
              ex.options.map((o) => o.id),
              `${id} (seed ${seed})`,
            ).not.toContain(other);
        }
      }
    }
  });
});

describe("silent mode", () => {
  const modes: SessionMode[] = [
    "leccion",
    "repaso",
    "examen",
    "escritura",
    "tarjetas",
    "tonos",
    "frases",
    "infinito",
  ];
  const words = vocab.entries.slice(0, 8);
  let history = emptyProgress();
  for (const w of words)
    for (const skill of ["meaning", "listening", "speaking"] as const)
      history = recordAnswer(history, w.id, skill, true, 10, "2026-11-01");
  const silentCtx = (seed: number): GenContext => ({ ...ctx(seed, history), speaking: false, silent: true });

  const needsSound = (ex: Exercise) =>
    ex.type === "speak" ||
    ((ex.type === "choice" || ex.type === "tiles" || ex.type === "typing") && ex.prompt.kind === "audio");

  it("the check above does detect sound exercises in normal sessions", () => {
    const list = buildSession({ mode: "escucha", lessons: [], words: [] }, vocab.entries, ctx(1, history));
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(needsSound)).toBe(true);
  });

  it.each(modes)("builds a %s session with nothing that needs sound", (mode) => {
    for (let seed = 1; seed <= 20; seed++) {
      const list = buildSession({ mode, lessons: [], words: [] }, vocab.entries, silentCtx(seed));
      expect(list.length, mode).toBeGreaterThan(0);
      list.forEach(assertValid);
      expect(list.filter(needsSound), mode).toEqual([]);
    }
  });

  it("has nothing to offer in the modes made of sound", () => {
    for (const mode of ["escucha", "pronunciacion"] as const)
      expect(buildSession({ mode, lessons: [], words: [] }, vocab.entries, silentCtx(1))).toEqual([]);
  });

  it("keeps the exam at the requested number of questions", () => {
    expect(
      buildSession({ mode: "examen", lessons: [], words: [], count: 20 }, vocab.entries, silentCtx(1)),
    ).toHaveLength(20);
  });

  it("keeps sentence sessions made only of sentences", () => {
    const list = buildSession({ mode: "frases", lessons: [], words: [] }, vocab.entries, silentCtx(1));
    expect(list.every((ex) => ex.skill === "sentences")).toBe(true);
  });

  it("infinite mode never asks for sound", () => {
    const c = silentCtx(7);
    for (let i = 0; i < 300; i++) expect(needsSound(nextInfinite(vocab.entries, c))).toBe(false);
  });

  it("reviews leave the listening and speaking items for later", () => {
    const list = buildSession({ mode: "repaso", lessons: [], words: [] }, words, silentCtx(1));
    expect(new Set(list.map((ex) => ex.skill))).toEqual(new Set(["meaning"]));
    const due = [
      { skill: "listening" as const },
      { skill: "speaking" as const },
      { skill: "meaning" as const },
      { skill: "pinyin" as const },
    ];
    expect(reviewable(due, false)).toEqual(due);
    expect(reviewable(due, true).map((d) => d.skill)).toEqual(["meaning", "pinyin"]);
  });
});

describe("writing exercises", () => {
  const styles = (list: Exercise[]) => list.map((ex) => (ex.type === "write" ? ex.style : ex.type));
  const session = (style: "guiado" | "libre" | "mixto", seed = 1) =>
    buildSession({ mode: "escritura", style, lessons: [], words: [] }, vocab.entries, ctx(seed));

  it("uses the chosen style", () => {
    expect(new Set(styles(session("guiado")))).toEqual(new Set(["guided"]));
    expect(new Set(styles(session("libre")))).toEqual(new Set(["free"]));
    expect(styles(session("mixto")).slice(0, 2)).toEqual(["guided", "free"]);
  });

  it("free drawing doesn't repeat the same words every session, as it never changes their strength", () => {
    const wordsOf = (list: Exercise[]) => list.map((ex) => ex.wordIds[0]).join();
    expect(wordsOf(session("libre", 1))).not.toBe(wordsOf(session("libre", 2)));
  });

  it("corrects only the writing of exams", () => {
    const exam = buildSession(
      { mode: "examen", withWriting: true, count: 40, lessons: [], words: [] },
      vocab.entries,
      ctx(),
    );
    expect(styles(exam)).toContain("graded");
    expect(styles(exam)).not.toContain("free");
  });

  it("spaced repetition always gets a result, so it never uses free drawing", () => {
    let progress = emptyProgress();
    const [word] = vocab.entries;
    for (const day of ["2026-11-01", "2026-11-03", "2026-11-08", "2026-11-20", "2026-12-20"])
      progress = recordAnswer(progress, word.id, "writing", true, 10, day);
    expect(styles([drillFor(word, "writing", ctx(1, progress))])).toEqual(["guided"]);
  });
});

describe("answer checking", () => {
  const c = ctx(3);
  const all = vocab.entries.flatMap((w) =>
    buildSession({ mode: "frases", lessons: [], words: [w.id] }, [w], c),
  );

  it("accepts the solution of every tiles exercise", () => {
    for (const ex of all) {
      if (ex.type !== "tiles") continue;
      const tokens = ex.lang === "zh" ? [ex.solution] : ex.solution.split(" ");
      expect(checkTiles(ex, tokens).correct, ex.solution).toBe(true);
      expect(checkTiles(ex, ex.lang === "zh" ? [ex.solution.slice(1)] : tokens.slice(0, -1)).correct).toBe(
        false,
      );
    }
  });

  it("accepts the alternative word orders listed in exercises.json (es-zh)", () => {
    const withAlternatives = all.filter((e) => e.type === "tiles" && e.lang === "zh" && e.answers.length > 1);
    expect(withAlternatives.length).toBeGreaterThan(0);
    for (const ex of withAlternatives) {
      if (ex.type !== "tiles") continue;
      for (const alternative of ex.answers.slice(1))
        expect(checkTiles(ex, [alternative]).correct, alternative).toBe(true);
    }
  });

  it("checks typed pinyin and Spanish leniently", () => {
    const [w] = vocab.entries.filter((v) => v.id === "laoshi");
    const pin = buildSession({ mode: "tonos", lessons: [], words: [] }, [w], c).find(
      (e) => e.type === "typing",
    );
    const typing: Extract<Exercise, { type: "typing" }> =
      pin?.type === "typing"
        ? pin
        : {
            key: "k",
            skill: "pinyin",
            wordIds: [w.id],
            instruction: "x",
            type: "typing",
            prompt: { kind: "text", text: "" },
            mode: "pinyin",
            answers: [w.pinyin],
            solution: w.pinyin,
          };
    expect(checkTyping(typing, "lao3 shi1").correct).toBe(true);
    const wrongTone = checkTyping(typing, "lao2shi1");
    expect(wrongTone.correct).toBe(false);
    expect(wrongTone.note).toMatch(/tonos/);
    const es: typeof typing = {
      ...typing,
      mode: "es",
      answers: ["compañero de clase"],
      solution: "compañero de clase",
    };
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

  it("ungraded practice earns flat XP and moves on without counting as an answer", () => {
    let s = initialSession("escritura", list.slice(0, 2));
    s = sessionReducer(s, { type: "practice" });
    expect(s).toMatchObject({
      index: 1,
      phase: "answer",
      practiced: 1,
      answered: 0,
      correct: 0,
      combo: 0,
      xp: PRACTICE_XP,
      log: [],
    });
    s = sessionReducer(s, { type: "practice" });
    expect(s).toMatchObject({ phase: "done", practiced: 2, xp: 2 * PRACTICE_XP });
    expect(sessionReducer(s, { type: "practice" })).toBe(s); // already finished
    expect(accuracy(s)).toBe(100); // no graded answers: the summary shows no accuracy
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
    for (const ok of [true, true, true, false])
      s = sessionReducer(s, { type: "answer", result: { correct: ok } });
    expect(s.phase).toBe("done");
    expect(examGrade(s)).toBe(7.5);
  });
});
