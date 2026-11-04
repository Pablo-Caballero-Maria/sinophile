/**
 * Runs before `next dev`, `next build`, the tests and the type check (npm pre-scripts),
 * and on `npm run validate`.
 *
 *  1. Reads every lesson folder data/lección N/ and fails with a clear message on
 *     JSON syntax errors (Vercel then keeps serving the previous deployment).
 *  2. Validates vocab + exercises and prints any issues (never fails on them: the
 *     app shows them in Ajustes → Estado de los datos).
 *  3. Writes the generated files the app reads:
 *       src/generated/lessons.json   all vocab.json files (bundled into the JS)
 *       public/data/exercises.json   all exercises.json files, keyed by lesson folder (fetched at runtime)
 *       public/data/cedict.json      the general dictionary
 *     and copies the stroke-order data of every character used to public/strokes/
 *     (from the hanzi-writer-data package).
 *
 * `--check` only validates (steps 1-2).
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sanitizeAllExercises, sanitizeLessons, type Issue, type LessonBundle } from "../src/lib/data/validate.ts";
import { hanChars } from "../src/lib/text.ts";
import { JsonSyntaxError, readDataDir, type RawData } from "./data-files.ts";

const root = new URL("../", import.meta.url);
const path = (p: string) => fileURLToPath(new URL(p, root));
const checkOnly = process.argv.includes("--check");

let raw: RawData;
try {
  raw = readDataDir(path("data"));
} catch (error) {
  if (!(error instanceof JsonSyntaxError)) throw error;
  console.error(`\n❌ ${error.message}\n`);
  process.exit(1);
}

const bundle: LessonBundle = { lessons: raw.lessons.map(({ folder, vocab }) => ({ folder, vocab })), ignored: raw.ignored };
const exercisesByLesson = Object.fromEntries(raw.lessons.filter((l) => l.exercises !== null).map((l) => [l.folder, l.exercises]));
const vocab = sanitizeLessons(bundle);
const exercises = sanitizeAllExercises(exercisesByLesson, vocab.lessons);

const icon = { error: "❌", warning: "⚠️ ", info: "ℹ️ " } as const;
const report = (issues: Issue[]) => issues.forEach((issue) => console.log(`${icon[issue.level]} ${issue.message}`));
report([...vocab.issues, ...exercises.issues]);
console.log(
  `✔ ${vocab.lessons.length} lecciones · ${vocab.entries.length} palabras · ` +
    `${Object.keys(exercises.file.words).length} con ejercicios propios` +
    (exercises.missing.length ? ` · ${exercises.missing.length} sin ejercicios` : ""),
);
if (checkOnly) process.exit(0);

const writeJson = (file: string, value: unknown) => writeFileSync(path(file), JSON.stringify(value) + "\n");

// Vocabulary, bundled into the app at build time.
mkdirSync(path("src/generated"), { recursive: true });
writeJson("src/generated/lessons.json", bundle);

// Runtime data fetched by the browser (recreated from scratch so no stale file survives).
rmSync(path("public/data"), { recursive: true, force: true });
mkdirSync(path("public/data"), { recursive: true });
writeJson("public/data/exercises.json", exercisesByLesson);
if (existsSync(path("data/cedict.json"))) copyFileSync(path("data/cedict.json"), path("public/data/cedict.json"));

// Stroke data for every character in vocab + example sentences.
const chars = new Set<string>();
for (const word of vocab.entries) hanChars(word.hanzi).forEach((c) => chars.add(c));
for (const set of Object.values(exercises.file.words)) {
  for (const s of set.examples) hanChars(s.zh.join("")).forEach((c) => chars.add(c));
}
rmSync(path("public/strokes"), { recursive: true, force: true });
mkdirSync(path("public/strokes"), { recursive: true });
let copied = 0;
for (const char of chars) {
  const source = path(`node_modules/hanzi-writer-data/${char}.json`);
  if (existsSync(source)) {
    copyFileSync(source, path(`public/strokes/${char}.json`));
    copied++;
  } else {
    console.log(`ℹ️  Sin datos de trazos locales para ${char} (se usará la CDN).`);
  }
}
console.log(`✔ trazos: ${copied}/${chars.size} caracteres copiados a public/strokes/`);
