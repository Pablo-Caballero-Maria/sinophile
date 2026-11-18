/**
 * The HSK 1 word list (the 150 words of HSK 2.0 level 1, data/hsk1.json, made by
 * `npm run hsk`) compared with the learner's vocabulary, for the home page.
 *
 * Each vocabulary word is split into HSK 1 words, covering as many characters as
 * possible:
 *  - an HSK 1 word inside a word you know counts as known: 本书 → 本 + 书,
 *    一月 → 一 + 月, and 件衣服 still teaches 衣服 although 件 isn't HSK 1;
 *  - a word that is an HSK 1 word, or is made only of HSK 1 words (星期一,
 *    本书), counts as one of your HSK 1 words;
 *  - a noun without its 子 suffix counts for the HSK 1 word with it (杯 → 杯子).
 */
import list from "@data/hsk1.json";
import type { VocabEntry } from "./types.ts";

export interface HskWord {
  hanzi: string;
  pinyin: string;
}

export const HSK1: HskWord[] = (list.words as string[][]).map(([hanzi, pinyin]) => ({ hanzi, pinyin }));

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

export function hskSummary(vocab: readonly VocabEntry[], words: readonly HskWord[] = HSK1): HskSummary {
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
export const percent = (part: number, total: number): number => (total ? Math.round((part / total) * 100) : 0);
