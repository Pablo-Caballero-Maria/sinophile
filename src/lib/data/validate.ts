/**
 * Validation + sanitisation of the hand-edited JSON files.
 *
 * Philosophy: never crash on bad data. Invalid entries are dropped and
 * reported as human-readable (Spanish) issues, which the app shows in
 * Ajustes → Estado de los datos and the build script prints to the log.
 *
 * Imports use explicit .ts extensions so Node can run this file directly.
 */
import type { CuratedExercise, ExercisesFile, Sentence, VocabEntry, WordSet } from "../types.ts";
import { hasHan } from "../text.ts";

export interface Issue {
  level: "error" | "warning" | "info";
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isTextArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);

/** Validates data/vocab.json. Returns the usable entries (first occurrence wins on duplicate ids). */
export function sanitizeVocab(raw: unknown): { entries: VocabEntry[]; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!Array.isArray(raw)) {
    return { entries: [], issues: [{ level: "error", message: "vocab.json debe ser una lista [ … ]." }] };
  }
  const seen = new Set<string>();
  const entries: VocabEntry[] = [];
  raw.forEach((item, index) => {
    const where = `vocab.json, entrada ${index + 1}`;
    if (!isObject(item)) {
      issues.push({ level: "error", message: `${where}: no es un objeto { … }.` });
      return;
    }
    const { id, hanzi, pinyin, es, lesson } = item;
    const missing = (["id", "hanzi", "pinyin", "es", "lesson"] as const).filter((k) => !isText(item[k]));
    if (missing.length) {
      issues.push({ level: "error", message: `${where}: falta o está vacío: ${missing.join(", ")}.` });
      return;
    }
    if (!hasHan(hanzi as string)) {
      issues.push({ level: "error", message: `${where} (${id}): "hanzi" no contiene caracteres chinos.` });
      return;
    }
    if (!DATE_RE.test(lesson as string)) {
      issues.push({ level: "error", message: `${where} (${id}): "lesson" debe tener formato AAAA-MM-DD.` });
      return;
    }
    if (seen.has(id as string)) {
      issues.push({ level: "error", message: `${where}: el id "${id}" está repetido; se ignora esta entrada.` });
      return;
    }
    seen.add(id as string);
    entries.push({
      id: (id as string).trim(),
      hanzi: (hanzi as string).trim(),
      pinyin: (pinyin as string).trim(),
      es: (es as string).trim(),
      lesson: (lesson as string).trim(),
    });
  });
  return { entries, issues };
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

/**
 * Validates data/exercises.json against the vocabulary.
 * `missing` lists vocab ids that have no exercise set yet.
 */
export function sanitizeExercises(
  raw: unknown,
  vocab: VocabEntry[],
): { file: ExercisesFile; issues: Issue[]; missing: string[] } {
  const issues: Issue[] = [];
  const file: ExercisesFile = { version: 1, words: {} };
  const byId = new Map(vocab.map((v) => [v.id, v]));
  if (!isObject(raw) || !isObject(raw.words)) {
    issues.push({ level: "error", message: `exercises.json debe tener la forma { "version": 1, "words": { … } }.` });
    return { file, issues, missing: vocab.map((v) => v.id) };
  }
  for (const [id, rawSet] of Object.entries(raw.words)) {
    const word = byId.get(id);
    if (!word) {
      issues.push({ level: "warning", message: `exercises.json: "${id}" no existe en vocab.json; se ignora.` });
      continue;
    }
    if (!isObject(rawSet)) {
      issues.push({ level: "error", message: `exercises.json → ${id}: debe ser un objeto.` });
      continue;
    }
    const set: WordSet = { examples: [], exercises: [] };
    if (isText(rawSet.note)) set.note = rawSet.note;
    (Array.isArray(rawSet.examples) ? rawSet.examples : []).forEach((ex, i) => {
      const sentence = sanitizeSentence(ex);
      // Keep index positions stable (exercises refer to examples by index).
      set.examples.push(sentence ?? { zh: [], pinyin: "", es: "" });
      if (!sentence) issues.push({ level: "error", message: `exercises.json → ${id}: el ejemplo ${i} no es válido.` });
      else if (!sentence.zh.join("").includes(word.hanzi))
        issues.push({ level: "info", message: `exercises.json → ${id}: el ejemplo ${i} no contiene "${word.hanzi}".` });
    });
    (Array.isArray(rawSet.exercises) ? rawSet.exercises : []).forEach((ex, i) => {
      const result = checkExercise(ex, set, word);
      if (typeof result === "string") issues.push({ level: "error", message: `exercises.json → ${id}, ejercicio ${i}: ${result}.` });
      else set.exercises.push(result);
    });
    file.words[id] = set;
  }
  const missing = vocab.filter((v) => !file.words[v.id]).map((v) => v.id);
  if (missing.length) {
    issues.push({
      level: "info",
      message: `Palabras sin ejercicios en exercises.json (se practican igualmente con ejercicios automáticos): ${missing.join(", ")}.`,
    });
  }
  return { file, issues, missing };
}
