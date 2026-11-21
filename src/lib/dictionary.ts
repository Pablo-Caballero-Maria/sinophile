/**
 * Search over your vocabulary (instant, Spanish) and CC-CEDICT (lazy-loaded,
 * English glosses). Queries can be hanzi, pinyin (with or without tones/numbers)
 * or Spanish/English words.
 */
import { canonicalPinyin, stripTones } from "./pinyin";
import { hasHan, normalizeLatin } from "./text";
import type { DictEntry, VocabEntry } from "./types";

interface Indexed {
  entry: DictEntry;
  /** toneless pinyin letters, no spaces */
  key: string;
  /** normalised meaning text, padded with spaces for whole-word search */
  meaning: string;
  /** normalised individual glosses ("hello; hi" -> ["hello", "hi"]) */
  glosses: string[];
}

const index = (entry: DictEntry): Indexed => ({
  entry,
  key: canonicalPinyin(entry.pinyin).letters,
  meaning: ` ${normalizeLatin(entry.meaning)} `,
  glosses: entry.meaning
    .split(/[;/,]/)
    .map((g) => normalizeLatin(g.replace(/\(.*?\)/g, "")))
    .filter(Boolean),
});

export const indexVocab = (vocab: VocabEntry[]): Indexed[] =>
  vocab.map((w) => index({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.es, source: "vocab", id: w.id }));

export type DictIndex = Indexed[];

let cedict: Promise<DictIndex> | null = null;
/** Downloads and indexes CC-CEDICT once (~3 MB gzip). */
export function loadCedict(): Promise<DictIndex> {
  cedict ??= fetch("/data/cedict.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ entries: [string, string, string][] }>;
    })
    .then((file) =>
      file.entries.map(([hanzi, pinyin, meaning]) => index({ hanzi, pinyin, meaning, source: "cedict" })),
    )
    .catch((error) => {
      cedict = null;
      throw error;
    });
  return cedict;
}

/** Relevance score of an entry for a query (0 = no match). */
function score(
  item: Indexed,
  query: string,
  han: boolean,
  q: { letters: string; tones: number[]; text: string },
): number {
  const { entry } = item;
  if (han) {
    if (entry.hanzi === query) return 100;
    if (entry.hanzi.startsWith(query)) return 70 - entry.hanzi.length;
    if (entry.hanzi.includes(query)) return 50 - entry.hanzi.length;
    return 0;
  }
  let best = 0;
  if (q.letters && item.key === q.letters) {
    const tonesMatch = q.tones.length === 0 || canonicalPinyin(entry.pinyin).tones.join() === q.tones.join();
    best = tonesMatch ? 95 : 60;
  } else if (q.letters.length >= 2 && item.key.startsWith(q.letters) && q.tones.length === 0) {
    best = 55 - (item.key.length - q.letters.length);
  }
  if (q.text) {
    const m = item.meaning;
    if (m.includes(` ${q.text} `)) {
      // whole-word hit; an exact gloss ("hello") ranks above longer definitions
      const exact = item.glosses.includes(q.text);
      best = Math.max(best, exact ? 90 : 75 - Math.min(20, m.length / 10));
    } else if (q.text.length >= 3 && m.includes(` ${q.text}`)) {
      best = Math.max(best, 40);
    }
  }
  return best ? best - entry.hanzi.length * 0.5 : 0;
}

export function search(items: DictIndex, query: string, limit = 40): DictEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const han = hasHan(trimmed);
  const canon = canonicalPinyin(trimmed);
  const q = { letters: canon.letters, tones: canon.tones, text: normalizeLatin(stripTones(trimmed)) };
  const hits: { entry: DictEntry; score: number }[] = [];
  for (const item of items) {
    const s = score(item, trimmed, han, q);
    if (s > 0) hits.push({ entry: item.entry, score: s });
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => h.entry);
}

/**
 * Greedy longest-match segmentation of Chinese text into known words
 * (falls back to single characters); non-Han runs are kept as one token.
 */
export function segmentText(text: string, known: Set<string>, maxLength = 4): string[] {
  const chars = [...text];
  const out: string[] = [];
  let i = 0;
  while (i < chars.length) {
    if (!hasHan(chars[i])) {
      let j = i;
      while (j < chars.length && !hasHan(chars[j])) j++;
      out.push(chars.slice(i, j).join(""));
      i = j;
      continue;
    }
    let len = Math.min(maxLength, chars.length - i);
    while (len > 1 && !known.has(chars.slice(i, i + len).join(""))) len--;
    out.push(chars.slice(i, i + len).join(""));
    i += len;
  }
  return out;
}

/** Exact headword lookups (for the word page and sentence tokens). */
export const lookup = (items: DictIndex, hanzi: string): DictEntry[] =>
  items.filter((i) => i.entry.hanzi === hanzi).map((i) => i.entry);
