/**
 * Reads the hand-edited data folder from disk (Node only: build script + tests).
 *
 *   data/
 *     lección 1/             ← one folder per class: "lección" + its number
 *       vocab.json           ← words of that class (written by hand)
 *       exercises.json       ← curated exercises for those words (Claude, see instructions.txt)
 *     lección 2/ …
 *     cedict.json            ← general dictionary (npm run dictionary)
 *     instructions.txt       ← how Claude writes exercises.json
 *
 * Only JSON *syntax* is checked here (a broken file throws JsonSyntaxError, which
 * fails the build so Vercel keeps the previous deployment). Everything else is
 * validated by src/lib/data/validate.ts so problems show up inside the app.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Files at the root of data/ that are not lessons. */
export const ROOT_FILES = ["cedict.json", "instructions.txt"];
/** Files inside a lesson folder. */
export const LESSON_FILES = ["vocab.json", "exercises.json"];

export interface RawLessonFolder {
  /** Folder name (should be "lección N"). */
  folder: string;
  /** Parsed vocab.json, or null when the file is missing. */
  vocab: unknown;
  /** Parsed exercises.json, or null when the file is missing. */
  exercises: unknown;
}

export interface RawData {
  lessons: RawLessonFolder[];
  /** Paths (relative to data/) that the app does not use, e.g. a stray data/vocab.json. */
  ignored: string[];
}

export class JsonSyntaxError extends Error {
  readonly file: string;
  readonly line: number | null;
  constructor(file: string, line: number | null, message: string) {
    super(`${file} no es JSON válido (línea ${line ?? "?"}): ${message}`);
    this.file = file;
    this.line = line;
  }
}

/** Parses JSON, reporting the line of a syntax error. `file` is only used in messages. */
export function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = (error as Error).message;
    const pos = Number(message.match(/position (\d+)/)?.[1]);
    const lineMatch = message.match(/line (\d+)/);
    const line = Number.isFinite(pos) ? text.slice(0, pos).split("\n").length : lineMatch ? Number(lineMatch[1]) : null;
    throw new JsonSyntaxError(file, line, message);
  }
}

function readJsonFile(dir: string, relative: string): unknown {
  const full = join(dir, relative);
  return existsSync(full) ? parseJson(readFileSync(full, "utf8"), `data/${relative}`) : null;
}

/** Reads every lesson folder of `dir` (sorted by name) plus the list of unused paths. */
export function readDataDir(dir: string): RawData {
  const lessons: RawLessonFolder[] = [];
  const ignored: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory()) {
      if (!ROOT_FILES.includes(entry.name)) ignored.push(entry.name);
      continue;
    }
    const folder = entry.name;
    for (const file of readdirSync(join(dir, folder))) {
      if (!LESSON_FILES.includes(file) && !file.startsWith(".")) ignored.push(`${folder}/${file}`);
    }
    lessons.push({
      folder,
      vocab: readJsonFile(dir, `${folder}/vocab.json`),
      exercises: readJsonFile(dir, `${folder}/exercises.json`),
    });
  }
  return { lessons, ignored };
}
