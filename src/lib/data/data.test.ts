import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readDataDir } from "../../../scripts/data-files";
import { claudePack } from "./claude-pack";
import { formatVocabFile, suggestId, vocabLine } from "./format";
import { isDateKey, sanitizeAllExercises, sanitizeExercises, sanitizeLessons, type LessonBundle } from "./validate";

const raw = readDataDir(fileURLToPath(new URL("../../../data", import.meta.url)));
const bundle: LessonBundle = { lessons: raw.lessons.map(({ folder, vocab }) => ({ folder, vocab })), ignored: raw.ignored };
const real = sanitizeLessons(bundle);
const exercisesByLesson = Object.fromEntries(raw.lessons.map((l) => [l.folder, l.exercises]));
const realExercises = sanitizeAllExercises(exercisesByLesson, real.lessons);

describe("data/ folder (the real lessons)", () => {
  it("has one valid lesson per class folder, numbered in date order", () => {
    expect(raw.ignored).toEqual([]);
    expect(real.issues).toEqual([]);
    expect(real.lessons).toHaveLength(raw.lessons.length);
    const ids = real.lessons.map((l) => l.id);
    expect(ids).toEqual([...ids].sort());
    expect(real.lessons.map((l) => l.number)).toEqual(ids.map((_, i) => i + 1));
    expect(ids.slice(0, 2)).toEqual(["2026-10-26", "2026-11-03"]);
  });

  it("every word has a valid exercise set", () => {
    expect(realExercises.issues.filter((i) => i.level !== "info")).toEqual([]);
    expect(realExercises.missing).toEqual([]);
  });

  it("curated sentences only use words of the same or earlier lessons", () => {
    const allowed = (lessonId: string) => new Set(real.entries.filter((w) => w.lesson <= lessonId).map((w) => w.hanzi));
    for (const lesson of real.lessons) {
      const known = allowed(lesson.id);
      for (const word of lesson.words) {
        const set = realExercises.file.words[word.id];
        const sentences = [...set.examples, ...set.exercises.flatMap((e) => (e.type === "dialogue" ? [e.prompt, e.answer, ...e.wrong] : []))];
        for (const s of sentences) {
          for (const token of s.zh) expect(known.has(token) || /^[，。！？、]$/.test(token), `${word.id}: ${token} (${s.zh.join("")})`).toBe(true);
        }
      }
    }
  });
});

describe("lesson validation", () => {
  const word = (id: string, hanzi = "你") => ({ id, hanzi, pinyin: "nǐ", es: "tú" });

  it("derives the lesson from the folder and numbers lessons by date", () => {
    const result = sanitizeLessons({
      lessons: [
        { folder: "2026-11-10", vocab: [word("b", "好")] },
        { folder: "2026-11-03", vocab: [word("a")] },
      ],
      ignored: [],
    });
    expect(result.issues).toEqual([]);
    expect(result.lessons.map((l) => [l.id, l.number, l.words.map((w) => w.id)])).toEqual([
      ["2026-11-03", 1, ["a"]],
      ["2026-11-10", 2, ["b"]],
    ]);
    expect(result.entries[1]).toEqual({ id: "b", hanzi: "好", pinyin: "nǐ", es: "tú", lesson: "2026-11-10" });
  });

  it("reports bad folders, missing files, stray files and repeated ids instead of crashing", () => {
    const result = sanitizeLessons({
      lessons: [
        { folder: "clase-3", vocab: [word("x")] },
        { folder: "2026-02-30", vocab: [word("y")] },
        { folder: "2026-11-03", vocab: null },
        { folder: "2026-11-10", vocab: [word("a"), word("a"), word("ni.hao"), { id: "z", hanzi: "abc", pinyin: "a", es: "b" }, 3] },
        { folder: "2026-11-17", vocab: [word("a"), word("c")] },
        { folder: "2026-11-24", vocab: { not: "a list" } },
      ],
      ignored: ["vocab.json", "2026-11-10/notas.txt"],
    });
    expect(result.lessons.map((l) => l.id)).toEqual(["2026-11-10", "2026-11-17"]);
    expect(result.entries.map((w) => `${w.lesson}:${w.id}`)).toEqual(["2026-11-10:a", "2026-11-17:c"]);
    const text = result.issues.map((i) => i.message).join("\n");
    expect(text).toContain("data/vocab.json se ignora");
    expect(text).toContain("data/2026-11-10/notas.txt se ignora");
    expect(text).toContain("data/clase-3/: el nombre de la carpeta");
    expect(text).toContain("data/2026-02-30/: el nombre de la carpeta");
    expect(text).toContain("data/2026-11-03/vocab.json no existe");
    expect(text).toContain('el id "a" ya existe en esta lección');
    expect(text).toContain('el id "a" ya existe en 2026-11-10/vocab.json');
    expect(text).toContain('el id "ni.hao" solo puede tener');
    expect(text).toContain("no contiene caracteres chinos");
    expect(text).toContain("2026-11-24/vocab.json debe ser una lista");
  });

  it("recognises real dates only", () => {
    expect(isDateKey("2026-10-26")).toBe(true);
    expect(isDateKey("2024-02-29")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2026-1-1")).toBe(false);
  });

  it("validates each lesson's exercises against that lesson's words", () => {
    const lessons = sanitizeLessons({
      lessons: [
        { folder: "2026-11-03", vocab: [word("ni")] },
        { folder: "2026-11-10", vocab: [word("hao", "好")] },
      ],
      ignored: [],
    }).lessons;
    const set = { examples: [{ zh: ["你", "好"], pinyin: "nǐ hǎo", es: "hola" }], exercises: [{ type: "fill", example: 5 }, { type: "nope" }, { type: "fill", example: 0 }] };
    const result = sanitizeAllExercises({ "2026-11-03": { version: 1, words: { ni: set, hao: set, ghost: set } } }, lessons);
    expect(Object.keys(result.file.words)).toEqual(["ni"]);
    expect(result.file.words.ni.exercises).toEqual([{ type: "fill", example: 0, blank: "你", distractors: undefined }]);
    expect(result.missing).toEqual(["hao"]);
    const text = result.issues.map((i) => `${i.level}: ${i.message}`).join("\n");
    expect(text).toContain('warning: 2026-11-03/exercises.json: "hao" es una palabra de 2026-11-10');
    expect(text).toContain('warning: 2026-11-03/exercises.json: "ghost" no existe');
    expect(text).toContain('error: 2026-11-03/exercises.json → ni, ejercicio 0: "example" (5) no existe');
    expect(text).toContain('error: 2026-11-03/exercises.json → ni, ejercicio 1: tipo desconocido "nope"');
    expect(text).toContain("info: 2026-11-10/exercises.json todavía no existe");
  });

  it("rejects an exercises.json with the wrong shape", () => {
    const lesson = { id: "2026-11-03", words: [] };
    expect(sanitizeExercises([], lesson).issues[0].message).toContain('debe tener la forma { "version": 1, "words"');
  });
});

describe("text for the data files", () => {
  const ni = { id: "ni-hao", hanzi: "你好", pinyin: "nǐ hǎo", es: "hola" };

  it("formats vocab lines like the hand-written files", () => {
    expect(vocabLine(ni)).toBe('{ "id": "ni-hao", "hanzi": "你好", "pinyin": "nǐ hǎo", "es": "hola" }');
    expect(JSON.parse(formatVocabFile([ni, ni]))).toEqual([ni, ni]);
    expect(suggestId("Xībānyá yǔ")).toBe("xibanya-yu");
  });

  it("builds the Claude package with earlier vocabulary and the target lesson", () => {
    const text = claudePack({ instructions: "INSTRUCCIONES", lessons: real.lessons, lessonId: "2026-11-03", exercises: null });
    expect(text).toContain("INSTRUCCIONES");
    expect(text).toContain("data/2026-10-26/vocab.json");
    expect(text).toContain("LECCIÓN NUEVA: data/2026-11-03/vocab.json");
    expect(text).toContain("(todavía no existe: créalo entero)");
    expect(text).toContain(vocabLine({ id: "mao", hanzi: "猫", pinyin: "māo", es: "gato" }));
    const first = claudePack({ instructions: "", lessons: real.lessons, lessonId: "2026-10-26", exercises: { version: 1, words: {} } });
    expect(first).toContain("(ninguna: es la primera lección)");
    expect(first).toContain('"version": 1');
    expect(first).not.toContain("猫");
  });
});
