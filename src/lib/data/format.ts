/**
 * Text formats the learner copies into the data files (one vocab entry per
 * line, like data/<date>/vocab.json is written by hand). Pure.
 */
import { normalizeLatin } from "../text";
import type { VocabEntry } from "../types";

type Word = Pick<VocabEntry, "id" | "hanzi" | "pinyin" | "es">;

/** `{ "id": "ni-hao", "hanzi": "你好", "pinyin": "nǐ hǎo", "es": "hola" }` */
export const vocabLine = ({ id, hanzi, pinyin, es }: Word): string =>
  `{ ${Object.entries({ id, hanzi, pinyin, es })
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ")} }`;

/** A whole vocab.json, one entry per line. */
export const formatVocabFile = (words: Word[]): string => `[\n${words.map((w) => `  ${vocabLine(w)}`).join(",\n")}\n]`;

/** A suggested id for a new word: its toneless pinyin with dashes ("nǐ hǎo" → "ni-hao"). */
export const suggestId = (pinyin: string): string => normalizeLatin(pinyin).replace(/\s+/g, "-") || "nueva";
