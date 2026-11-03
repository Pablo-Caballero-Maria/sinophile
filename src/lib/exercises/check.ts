/** Answer checking for the exercise types that need more than an id comparison. */
import { pinyinEquals, prettifyTyped } from "../pinyin";
import { normalizeLatin, normalizeZh } from "../text";
import type { AnswerResult, Exercise } from "./types";

type Of<T extends Exercise["type"]> = Extract<Exercise, { type: T }>;

/** Classic edit distance (small strings only). */
export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

const ARTICLES = /^(el|la|los|las|un|una|unos|unas|lo) /;
const stripArticle = (s: string) => s.replace(ARTICLES, "");

export function checkTiles(ex: Of<"tiles">, chosen: string[]): AnswerResult {
  const given = ex.lang === "zh" ? chosen.join("") : chosen.join(" ");
  const normalized = ex.lang === "zh" ? normalizeZh(given) : normalizeLatin(given);
  return { correct: ex.answers.includes(normalized), given, solution: ex.solution };
}

export function checkTyping(ex: Of<"typing">, input: string): AnswerResult {
  const given = input.trim();
  if (ex.mode === "pinyin") {
    const pretty = prettifyTyped(given);
    if (ex.answers.some((a) => pinyinEquals(given, a))) return { correct: true, given: pretty, solution: ex.solution };
    const almost = ex.answers.some((a) => pinyinEquals(given, a, true));
    return { correct: false, given: pretty, solution: ex.solution, note: almost ? "Las letras están bien, pero revisa los tonos." : undefined };
  }
  const typed = stripArticle(normalizeLatin(given));
  const answers = ex.answers.map((a) => stripArticle(normalizeLatin(a)));
  if (typed && answers.includes(typed)) return { correct: true, given, solution: ex.solution };
  const close = typed.length >= 4 && answers.some((a) => levenshtein(a, typed) <= (a.length > 7 ? 2 : 1));
  if (close) return { correct: true, given, solution: ex.solution, note: "¡Casi! Ojo con la ortografía." };
  return { correct: false, given, solution: ex.solution };
}

export function checkChoice(ex: Of<"choice">, optionId: string): AnswerResult {
  const label = (id: string) => ex.options.find((o) => o.id === id)?.display.text ?? id;
  return { correct: optionId === ex.answerId, given: label(optionId), solution: label(ex.answerId), note: ex.explanation };
}
