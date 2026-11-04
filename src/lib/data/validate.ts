/**
 * Validation + sanitisation of the hand-edited lesson data (data/<date>/*.json).
 *
 * Philosophy: never crash on bad data. Invalid entries are dropped and
 * reported as human-readable (Spanish) issues, which the app shows in
 * Ajustes → Estado de los datos and the build script prints to the log.
 *
 * Imports use explicit .ts extensions so Node can run this file directly.
 */
import type { CuratedExercise, ExercisesFile, Lesson, Sentence, VocabEntry, WordSet } from "../types.ts";
import { hasHan } from "../text.ts";

export interface Issue {
  level: "error" | "warning" | "info";
  message: string;
}

/** What scripts/prepare-data.ts bundles for the app (src/generated/lessons.json). */
export interface LessonBundle {
  lessons: { folder: string; vocab: unknown }[];
  /** Paths inside data/ that are not part of any lesson. */
  ignored: string[];
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Word ids end up as keys of the stored progress, so they are kept to a safe alphabet. */
export const WORD_ID_RE = /^[A-Za-z0-9_-]+$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isTextArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);

/** True for a real calendar date written as YYYY-MM-DD. */
export function isDateKey(text: string): boolean {
  const m = DATE_RE.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * Validates one lesson's vocab.json. `seen` maps ids already used by earlier
 * lessons to their lesson, so ids stay unique across the whole vocabulary
 * (progress is stored per word id). The first occurrence wins.
 */
export function sanitizeVocab(
  raw: unknown,
  lessonId: string,
  seen: Map<string, string> = new Map(),
): { entries: VocabEntry[]; issues: Issue[] } {
  const file = `${lessonId}/vocab.json`;
  const issues: Issue[] = [];
  if (!Array.isArray(raw)) {
    return { entries: [], issues: [{ level: "error", message: `${file} debe ser una lista [ … ].` }] };
  }
  const entries: VocabEntry[] = [];
  raw.forEach((item, index) => {
    const where = `${file}, entrada ${index + 1}`;
    if (!isObject(item)) {
      issues.push({ level: "error", message: `${where}: no es un objeto { … }.` });
      return;
    }
    const missing = (["id", "hanzi", "pinyin", "es"] as const).filter((k) => !isText(item[k]));
    if (missing.length) {
      issues.push({ level: "error", message: `${where}: falta o está vacío: ${missing.join(", ")}.` });
      return;
    }
    const [id, hanzi, pinyin, es] = (["id", "hanzi", "pinyin", "es"] as const).map((k) => (item[k] as string).trim());
    if (!WORD_ID_RE.test(id)) {
      issues.push({ level: "error", message: `${where}: el id "${id}" solo puede tener letras sin tildes, números, «-» y «_».` });
      return;
    }
    if (!hasHan(hanzi)) {
      issues.push({ level: "error", message: `${where} (${id}): "hanzi" no contiene caracteres chinos.` });
      return;
    }
    const previous = seen.get(id);
    if (previous) {
      const place = previous === lessonId ? "en esta lección" : `en ${previous}/vocab.json`;
      issues.push({ level: "error", message: `${where}: el id "${id}" ya existe ${place}; se ignora esta entrada.` });
      return;
    }
    seen.set(id, lessonId);
    entries.push({ id, hanzi, pinyin, es, lesson: lessonId });
  });
  return { entries, issues };
}

/** Validates every lesson folder. Lessons are numbered in date order. */
export function sanitizeLessons(bundle: LessonBundle): { lessons: Lesson[]; entries: VocabEntry[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  const lessons: Lesson[] = [];
  for (const path of bundle.ignored) {
    issues.push({
      level: "warning",
      message: `data/${path} se ignora: cada clase va en su carpeta data/AAAA-MM-DD/ con vocab.json y exercises.json.`,
    });
  }
  const folders = [...bundle.lessons].sort((a, b) => a.folder.localeCompare(b.folder));
  for (const { folder, vocab } of folders) {
    if (!isDateKey(folder)) {
      issues.push({ level: "error", message: `data/${folder}/: el nombre de la carpeta debe ser la fecha de la clase (AAAA-MM-DD); se ignora.` });
      continue;
    }
    if (vocab === null || vocab === undefined) {
      issues.push({ level: "error", message: `data/${folder}/vocab.json no existe; se ignora esta clase.` });
      continue;
    }
    const result = sanitizeVocab(vocab, folder, seen);
    issues.push(...result.issues);
    if (result.entries.length === 0) {
      issues.push({ level: "warning", message: `${folder}/vocab.json no tiene ninguna palabra válida.` });
      continue;
    }
    lessons.push({ id: folder, number: lessons.length + 1, words: result.entries });
  }
  return { lessons, entries: lessons.flatMap((l) => l.words), issues };
}

function sanitizeSentence(raw: unknown): Sentence | null {
  if (!isObject(raw) || !isTextArray(raw.zh) || raw.zh.length === 0) return null;
  if (!isText(raw.pinyin) || !isText(raw.es)) return null;
  return { zh: raw.zh, pinyin: raw.pinyin, es: raw.es };
}

/** Returns the exercise if valid for this word set, or an error message. */
function checkExercise(raw: unknown, set: WordSet, word: VocabEntry): CuratedExercise | string {
  if (!isObject(raw)) return "no es un objeto";
  const example = (i: unknown) => {
    const sentence = typeof i === "number" ? set.examples[i] : undefined;
    return sentence && sentence.zh.length > 0 ? sentence : undefined; // empty = invalid placeholder
  };
  const optionalTexts = (v: unknown) => v === undefined || isTextArray(v);
  switch (raw.type) {
    case "fill": {
      const sentence = example(raw.example);
      if (!sentence) return `"example" (${String(raw.example)}) no existe`;
      const blank = raw.blank ?? word.hanzi;
      if (!isText(blank) || !sentence.zh.includes(blank)) return `el hueco "${String(blank)}" no es un token de la frase`;
      if (!optionalTexts(raw.distractors)) return `"distractors" debe ser una lista de textos`;
      return { type: "fill", example: raw.example as number, blank, distractors: raw.distractors as string[] | undefined };
    }
    case "translate": {
      if (!example(raw.example)) return `"example" (${String(raw.example)}) no existe`;
      if (raw.direction !== "zh-es" && raw.direction !== "es-zh") return `"direction" debe ser "zh-es" o "es-zh"`;
      if (!optionalTexts(raw.distractors) || !optionalTexts(raw.accept)) return `"distractors"/"accept" deben ser listas de textos`;
      return {
        type: "translate",
        example: raw.example as number,
        direction: raw.direction,
        distractors: raw.distractors as string[] | undefined,
        accept: raw.accept as string[] | undefined,
      };
    }
    case "dialogue": {
      const prompt = sanitizeSentence(raw.prompt);
      const answer = sanitizeSentence(raw.answer);
      const wrong = Array.isArray(raw.wrong) ? raw.wrong.map(sanitizeSentence) : [];
      if (!prompt || !answer) return `"prompt" y "answer" deben ser frases válidas`;
      if (wrong.length === 0 || wrong.some((w) => !w)) return `"wrong" debe ser una lista de frases válidas`;
      return { type: "dialogue", prompt, answer, wrong: wrong as Sentence[] };
    }
    case "choice": {
      if (!isText(raw.question) || !isTextArray(raw.options) || raw.options.length < 2) return "necesita question y al menos 2 options";
      if (!isText(raw.answer) || !raw.options.includes(raw.answer)) return `"answer" debe ser una de las options`;
      if (raw.explanation !== undefined && !isText(raw.explanation)) return `"explanation" debe ser texto`;
      return { type: "choice", question: raw.question, options: raw.options, answer: raw.answer, explanation: raw.explanation as string | undefined };
    }
    default:
      return `tipo desconocido "${String(raw.type)}"`;
  }
}

export interface ExercisesResult {
  file: ExercisesFile;
  issues: Issue[];
  /** Vocab ids that have no exercise set yet. */
  missing: string[];
}

/**
 * Validates one lesson's exercises.json against that lesson's words.
 * `raw === null` means the file does not exist yet.
 */
export function sanitizeExercises(raw: unknown, lesson: Pick<Lesson, "id" | "words">, allWords: VocabEntry[] = lesson.words): ExercisesResult {
  const file = `${lesson.id}/exercises.json`;
  const issues: Issue[] = [];
  const out: ExercisesFile = { version: 1, words: {} };
  const byId = new Map(lesson.words.map((v) => [v.id, v]));
  const allIds = new Map(allWords.map((v) => [v.id, v.lesson]));
  const missingIds = () => lesson.words.filter((v) => !out.words[v.id]).map((v) => v.id);

  if (raw === null || raw === undefined) {
    issues.push({
      level: "info",
      message: `${file} todavía no existe: sus ${lesson.words.length} palabras se practican solo con ejercicios automáticos.`,
    });
    return { file: out, issues, missing: missingIds() };
  }
  if (!isObject(raw) || !isObject(raw.words)) {
    issues.push({ level: "error", message: `${file} debe tener la forma { "version": 1, "words": { … } }.` });
    return { file: out, issues, missing: missingIds() };
  }
  for (const [id, rawSet] of Object.entries(raw.words)) {
    const word = byId.get(id);
    if (!word) {
      const elsewhere = allIds.get(id);
      const why = elsewhere ? `es una palabra de ${elsewhere}, no de esta clase` : "no existe en su vocab.json";
      issues.push({ level: "warning", message: `${file}: "${id}" ${why}; se ignora.` });
      continue;
    }
    if (!isObject(rawSet)) {
      issues.push({ level: "error", message: `${file} → ${id}: debe ser un objeto.` });
      continue;
    }
    const set: WordSet = { examples: [], exercises: [] };
    if (isText(rawSet.note)) set.note = rawSet.note;
    (Array.isArray(rawSet.examples) ? rawSet.examples : []).forEach((ex, i) => {
      const sentence = sanitizeSentence(ex);
      // Keep index positions stable (exercises refer to examples by index).
      set.examples.push(sentence ?? { zh: [], pinyin: "", es: "" });
      if (!sentence) issues.push({ level: "error", message: `${file} → ${id}: el ejemplo ${i} no es válido.` });
      else if (!sentence.zh.join("").includes(word.hanzi))
        issues.push({ level: "info", message: `${file} → ${id}: el ejemplo ${i} no contiene "${word.hanzi}".` });
    });
    (Array.isArray(rawSet.exercises) ? rawSet.exercises : []).forEach((ex, i) => {
      const result = checkExercise(ex, set, word);
      if (typeof result === "string") issues.push({ level: "error", message: `${file} → ${id}, ejercicio ${i}: ${result}.` });
      else set.exercises.push(result);
    });
    out.words[id] = set;
  }
  const missing = missingIds();
  if (missing.length) {
    issues.push({
      level: "info",
      message: `${file}: palabras sin ejercicios propios (se practican igualmente con los automáticos): ${missing.join(", ")}.`,
    });
  }
  return { file: out, issues, missing };
}

/**
 * Validates the exercises of every lesson (keyed by lesson folder) and combines them.
 * (Exercise files of folders that are not valid lessons were already reported by sanitizeLessons.)
 */
export function sanitizeAllExercises(rawByLesson: Record<string, unknown>, lessons: Lesson[]): ExercisesResult {
  const all = lessons.flatMap((l) => l.words);
  const combined: ExercisesResult = { file: { version: 1, words: {} }, issues: [], missing: [] };
  for (const lesson of lessons) {
    const result = sanitizeExercises(rawByLesson[lesson.id] ?? null, lesson, all);
    Object.assign(combined.file.words, result.file.words);
    combined.issues.push(...result.issues);
    combined.missing.push(...result.missing);
  }
  return combined;
}
