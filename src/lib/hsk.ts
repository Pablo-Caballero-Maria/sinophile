/**
 * The HSK 2 word list of HSK 3.0 (the 500 words of levels 1 and 2 of the 2025 syllabus,
 * data/hsk2.json, made by `npm run hsk`) compared with the learner's vocabulary, for the home
 * page.
 *
 * Each vocabulary word is split into HSK words, covering as many characters as possible:
 *  - an HSK word inside a word you know counts as known: 本书 → 本 + 书,
 *    一月 → 一 + 月, and 件衣服 still teaches 衣服 although 件 isn't in the list;
 *  - a word that is an HSK word, or is made only of HSK words (星期一, 本书), counts
 *    as one of your HSK words;
 *  - a noun without its 子 suffix counts for the HSK word with it (杯 → 杯子).
 * Words written alike (点 the classifier and 点 the verb) are known together.
 */
import list from "@data/hsk2.json";
import type { VocabEntry } from "./types.ts";

export interface HskWord {
  hanzi: string;
  pinyin: string;
  /** 1 or 2: the level that introduces it (HSK 2 includes the 300 words of HSK 1). */
  level: number;
  /** Part of speech as the syllabus writes it ("名", "动、（名）"…). */
  pos: string;
}

export const HSK: HskWord[] = (list.words as [string, string, number, string][]).map(
  ([hanzi, pinyin, level, pos]) => ({ hanzi, pinyin, level, pos }),
);

const POS_LABELS: Record<string, string> = {
  名: "sustantivo",
  动: "verbo",
  形: "adjetivo",
  副: "adverbio",
  量: "clasificador",
  数: "número",
  代: "pronombre",
  介: "preposición",
  连: "conjunción",
  助: "partícula",
  叹: "interjección",
  后缀: "sufijo",
  前缀: "prefijo",
};

/** The main part of speech of a word, in Spanish ("量、（名）" → "clasificador"). */
export function posLabel(pos: string): string {
  const main = pos.split(/[、（]/)[0]!.trim();
  return POS_LABELS[main] ?? main;
}

/** Characters that are more than one word of the list (点, 花, 过): those show their part of speech. */
export const HOMOGRAPHS: ReadonlySet<string> = new Set(
  HSK.filter((w, i) => HSK.findIndex((other) => other.hanzi === w.hanzi) !== i).map((w) => w.hanzi),
);

/**
 * Splits `hanzi` into words of `hsk`, covering as many characters as possible (then
 * with the fewest pieces). `complete` is false when some character is left out.
 */
export function hskPieces(hanzi: string, hsk: ReadonlySet<string>): { pieces: string[]; complete: boolean } {
  if (!hsk.has(hanzi) && hsk.has(`${hanzi}子`)) return { pieces: [`${hanzi}子`], complete: true };
  const chars = [...hanzi];
  // best[i]: best split of the first i characters.
  const best: { missing: number; pieces: string[] }[] = [{ missing: 0, pieces: [] }];
  const better = (a: { missing: number; pieces: string[] }, b?: { missing: number; pieces: string[] }) =>
    !b || a.missing < b.missing || (a.missing === b.missing && a.pieces.length < b.pieces.length);
  for (let i = 0; i < chars.length; i++) {
    const from = best[i];
    const skip = { missing: from.missing + 1, pieces: from.pieces };
    if (better(skip, best[i + 1])) best[i + 1] = skip;
    for (let end = i + 1; end <= chars.length; end++) {
      const word = chars.slice(i, end).join("");
      const take = { missing: from.missing, pieces: [...from.pieces, word] };
      if (hsk.has(word) && better(take, best[end])) best[end] = take;
    }
  }
  const { missing, pieces } = best[chars.length];
  return { pieces, complete: missing === 0 && pieces.length > 0 };
}

export interface HskSummary {
  /** Vocabulary words that are HSK words or made only of HSK words. */
  hskWords: VocabEntry[];
  /** HSK word -> the vocabulary word that teaches it (the word itself when it is in the vocabulary). */
  known: Map<string, VocabEntry>;
}

export function hskSummary(
  vocab: readonly VocabEntry[],
  words: readonly Pick<HskWord, "hanzi">[] = HSK,
): HskSummary {
  const hsk = new Set(words.map((w) => w.hanzi));
  const hskWords: VocabEntry[] = [];
  const known = new Map<string, VocabEntry>();
  const exact = new Set<string>();
  for (const entry of vocab) {
    const { pieces, complete } = hskPieces(entry.hanzi, hsk);
    if (complete) hskWords.push(entry);
    const whole = pieces.length === 1 && complete;
    for (const piece of pieces) {
      if (exact.has(piece)) continue;
      if (whole) exact.add(piece);
      if (whole || !known.has(piece)) known.set(piece, entry);
    }
  }
  return { hskWords, known };
}

/** Rounded percentage of `part` in `total` (0 when the total is 0). */
export const percent = (part: number, total: number): number =>
  total ? Math.round((part / total) * 100) : 0;
