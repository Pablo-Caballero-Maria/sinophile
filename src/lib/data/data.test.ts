import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readDataDir } from "../../../scripts/data-files";
import { suggestId, vocabLine } from "./format";
import { lessonNumber, sanitizeAllExercises, sanitizeExercises, sanitizeLessons, type LessonBundle } from "./validate";

const raw = readDataDir(fileURLToPath(new URL("../../../data", import.meta.url)));
const bundle: LessonBundle = { lessons: raw.lessons.map(({ folder, vocab }) => ({ folder, vocab })), ignored: raw.ignored };
const real = sanitizeLessons(bundle);
const exercisesByFolder = Object.fromEntries(raw.lessons.map((l) => [l.folder, l.exercises]));
const realExercises = sanitizeAllExercises(exercisesByFolder, real.lessons);

describe("data/ folder (the real lessons)", () => {
  it("has one valid «lección N» folder per class, in order", () => {
    expect(raw.ignored).toEqual([]);
    expect(real.issues).toEqual([]);
    expect(real.lessons).toHaveLength(raw.lessons.length);
    expect(real.lessons.map((l) => l.number)).toEqual(real.lessons.map((_, i) => i + 1));
    expect(real.lessons.slice(0, 2).map((l) => [l.id, l.folder])).toEqual([
      ["1", "lección 1"],
      ["2", "lección 2"],
    ]);
  });

  it("every word has a valid exercise set", () => {
    expect(realExercises.issues.filter((i) => i.level !== "info")).toEqual([]);
    expect(realExercises.missing).toEqual([]);
  });

  it("curated sentences only use words of the same or earlier lessons", () => {
    const numberOf = new Map(real.lessons.map((l) => [l.id, l.number]));
    for (const lesson of real.lessons) {
      const known = new Set(real.entries.filter((w) => numberOf.get(w.lesson)! <= lesson.number).map((w) => w.hanzi));
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

describe("words the learner asked to fix", () => {
  const wordOf = (hanzi: string) => real.entries.find((w) => w.hanzi === hanzi);

  it("«domingo» is 星期日 and no exercise offers 星期天 (only the word's note mentions it)", () => {
    expect(wordOf("星期日")).toMatchObject({ id: "xingqitian", pinyin: "xīngqīrì", es: "domingo", lesson: "2" });
    expect(wordOf("星期天")).toBeUndefined();
    const { note, ...exercises } = realExercises.file.words.xingqitian;
    expect(note).toContain("星期天");
    const others = Object.entries(realExercises.file.words).filter(([id]) => id !== "xingqitian");
    expect(JSON.stringify([exercises, others])).not.toContain("星期天");
    expect(JSON.stringify([exercises, others])).not.toMatch(/ngqītiān/i);
  });

  it("lesson 1 has the nationalities, told apart from the languages", () => {
    expect(wordOf("中国人")).toMatchObject({ pinyin: "Zhōngguórén", es: "chino (nacionalidad)", lesson: "1" });
    expect(wordOf("西班牙人")).toMatchObject({ pinyin: "Xībānyárén", es: "español (nacionalidad)", lesson: "1" });
    expect(wordOf("中文")?.es).toBe("chino");
    expect(wordOf("西班牙语")?.es).toBe("español");
  });
});

describe("lesson validation", () => {
  const word = (id: string, hanzi = "你") => ({ id, hanzi, pinyin: "nǐ", es: "tú" });

  it("reads the lesson number from the folder name", () => {
    expect(lessonNumber("lección 1")).toBe(1);
    expect(lessonNumber("Lección 12")).toBe(12);
    expect(lessonNumber("leccion-3")).toBe(3);
    expect(lessonNumber("leccio\u0301n 4")).toBe(4); // «ó» written as o + combining accent
    expect(lessonNumber("lección 0")).toBeNull();
    expect(lessonNumber("2026-11-03")).toBeNull();
    expect(lessonNumber("tema 1")).toBeNull();
  });

  it("orders lessons by number (10 after 9) and takes the lesson from the folder", () => {
    const result = sanitizeLessons({
      lessons: [
        { folder: "lección 10", vocab: [word("c", "们")] },
        { folder: "lección 9", vocab: [word("b", "好")] },
        { folder: "lección 1", vocab: [word("a")] },
      ],
      ignored: [],
    });
    expect(result.issues).toEqual([]);
    expect(result.lessons.map((l) => [l.id, l.number, l.folder, l.words.map((w) => w.id)])).toEqual([
      ["1", 1, "lección 1", ["a"]],
      ["9", 9, "lección 9", ["b"]],
      ["10", 10, "lección 10", ["c"]],
    ]);
    expect(result.entries[1]).toEqual({ id: "b", hanzi: "好", pinyin: "nǐ", es: "tú", lesson: "9" });
  });

  it("reports bad folders, missing files, stray files and repeated ids instead of crashing", () => {
    const result = sanitizeLessons({
      lessons: [
        { folder: "clase 3", vocab: [word("x")] },
        { folder: "lección 2", vocab: null },
        { folder: "lección 3", vocab: [word("a"), word("a"), word("ni.hao"), { id: "z", hanzi: "abc", pinyin: "a", es: "b" }, 3] },
        { folder: "Leccion 3", vocab: [word("y")] },
        { folder: "lección 4", vocab: [word("a"), word("c")] },
        { folder: "lección 5", vocab: { not: "a list" } },
      ],
      ignored: ["vocab.json", "lección 3/notas.txt"],
    });
    expect(result.lessons.map((l) => l.folder)).toEqual(["lección 3", "lección 4"]);
    expect(result.entries.map((w) => `${w.lesson}:${w.id}`)).toEqual(["3:a", "4:c"]);
    const text = result.issues.map((i) => i.message).join("\n");
    expect(text).toContain("data/vocab.json se ignora");
    expect(text).toContain("data/lección 3/notas.txt se ignora");
    expect(text).toContain("data/clase 3/: el nombre de la carpeta");
    expect(text).toContain("data/lección 2/vocab.json no existe");
    expect(text).toContain("data/Leccion 3/: ya existe la carpeta «lección 3»");
    expect(text).toContain('el id "a" ya existe en esta lección');
    expect(text).toContain('el id "a" ya existe en lección 3/vocab.json');
    expect(text).toContain('el id "ni.hao" solo puede tener');
    expect(text).toContain("no contiene caracteres chinos");
    expect(text).toContain("lección 5/vocab.json debe ser una lista");
  });

  it("validates each lesson's exercises against that lesson's words", () => {
    const lessons = sanitizeLessons({
      lessons: [
        { folder: "lección 1", vocab: [word("ni")] },
        { folder: "lección 2", vocab: [word("hao", "好")] },
      ],
      ignored: [],
    }).lessons;
    const set = { examples: [{ zh: ["你", "好"], pinyin: "nǐ hǎo", es: "hola" }], exercises: [{ type: "fill", example: 5 }, { type: "nope" }, { type: "fill", example: 0 }] };
    const result = sanitizeAllExercises({ "lección 1": { version: 1, words: { ni: set, hao: set, ghost: set } } }, lessons);
    expect(Object.keys(result.file.words)).toEqual(["ni"]);
    expect(result.file.words.ni.exercises).toEqual([{ type: "fill", example: 0, blank: "你", distractors: undefined }]);
    expect(result.missing).toEqual(["hao"]);
    const text = result.issues.map((i) => `${i.level}: ${i.message}`).join("\n");
    expect(text).toContain('warning: lección 1/exercises.json: "hao" es una palabra de la lección 2');
    expect(text).toContain('warning: lección 1/exercises.json: "ghost" no existe');
    expect(text).toContain('error: lección 1/exercises.json → ni, ejercicio 0: "example" (5) no existe');
    expect(text).toContain('error: lección 1/exercises.json → ni, ejercicio 1: tipo desconocido "nope"');
    expect(text).toContain("info: lección 2/exercises.json todavía no existe");
  });

  it("rejects an exercises.json with the wrong shape", () => {
    const lesson = { folder: "lección 1", words: [] };
    expect(sanitizeExercises([], lesson).issues[0].message).toContain('debe tener la forma { "version": 1, "words"');
  });
});

describe("text for the data files", () => {
  it("formats vocab lines like the hand-written files", () => {
    const ni = { id: "ni-hao", hanzi: "你好", pinyin: "nǐ hǎo", es: "hola" };
    expect(vocabLine(ni)).toBe('{ "id": "ni-hao", "hanzi": "你好", "pinyin": "nǐ hǎo", "es": "hola" }');
    expect(JSON.parse(vocabLine(ni))).toEqual(ni);
    expect(suggestId("Xībānyá yǔ")).toBe("xibanya-yu");
  });
});
