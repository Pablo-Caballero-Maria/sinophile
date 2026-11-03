/**
 * Runs before `next dev` / `next build` (npm pre-scripts) and on `npm run validate`.
 *
 *  1. Parses data/*.json and fails with a clear message on JSON syntax errors
 *     (Vercel then keeps serving the previous deployment).
 *  2. Validates vocab + exercises and prints any issues (never fails on them).
 *  3. Copies runtime data to public/data/ and the stroke-order data of every
 *     character used to public/strokes/ (from the hanzi-writer-data package).
 *
 * `--check` only validates (steps 1-2).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { sanitizeExercises, sanitizeVocab, type Issue } from "../src/lib/data/validate.ts";
import { hanChars } from "../src/lib/text.ts";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const path = (p: string) => fileURLToPath(new URL(p, root));
const checkOnly = process.argv.includes("--check");

function readJson(file: string): unknown {
  const text = readFileSync(path(file), "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = (error as Error).message;
    const pos = Number(message.match(/position (\d+)/)?.[1]);
    const line = Number.isFinite(pos) ? text.slice(0, pos).split("\n").length : "?";
    console.error(`\n❌ ${file} no es JSON válido (línea ${line}): ${message}\n`);
    process.exit(1);
  }
}

function report(issues: Issue[]) {
  const icon = { error: "❌", warning: "⚠️ ", info: "ℹ️ " } as const;
  for (const issue of issues) console.log(`${icon[issue.level]} ${issue.message}`);
}

const vocab = sanitizeVocab(readJson("data/vocab.json"));
const exercises = sanitizeExercises(readJson("data/exercises.json"), vocab.entries);
readJson("data/progress.json");
report([...vocab.issues, ...exercises.issues]);
console.log(
  `✔ vocab: ${vocab.entries.length} palabras · exercises: ${Object.keys(exercises.file.words).length} conjuntos` +
    (exercises.missing.length ? ` · ${exercises.missing.length} palabras sin ejercicios` : ""),
);
if (checkOnly) process.exit(0);

// Runtime data fetched by the browser.
mkdirSync(path("public/data"), { recursive: true });
for (const file of ["exercises.json", "progress.json", "cedict.json"]) {
  if (existsSync(path(`data/${file}`))) copyFileSync(path(`data/${file}`), path(`public/data/${file}`));
}

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
