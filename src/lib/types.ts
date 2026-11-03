/**
 * Shared domain types. The JSON files in /data follow these shapes;
 * see data/instructions.txt for the human/LLM-facing description.
 */

/** One word as written by hand in data/vocab.json. */
export interface VocabEntry {
  id: string;
  hanzi: string;
  pinyin: string;
  /** Spanish meaning(s). Several meanings may be separated by "/", ";" or ",". */
  es: string;
  /** Lesson date, YYYY-MM-DD. Words sharing a date form a lesson. */
  lesson: string;
}

/** An example sentence. `zh` holds the tokens (words + punctuation) that join into the sentence. */
export interface Sentence {
  zh: string[];
  pinyin: string;
  es: string;
}

/** Hand-made exercises stored in data/exercises.json (see instructions.txt). */
export type CuratedExercise =
  | {
      type: "fill";
      /** Index into the word's `examples`. */
      example: number;
      /** Token to hide; defaults to the word's own hanzi. */
      blank?: string;
      distractors?: string[];
    }
  | {
      type: "translate";
      example: number;
      direction: "zh-es" | "es-zh";
      distractors?: string[];
      /** Other valid translations (for zh-es). */
      accept?: string[];
    }
  | { type: "dialogue"; prompt: Sentence; answer: Sentence; wrong: Sentence[] }
  | { type: "choice"; question: string; options: string[]; answer: string; explanation?: string };

export interface WordSet {
  note?: string;
  examples: Sentence[];
  exercises: CuratedExercise[];
}

export interface ExercisesFile {
  version: number;
  words: Record<string, WordSet>;
}

/** Practice areas; progress and spaced repetition are tracked per word and skill. */
export type Skill = "meaning" | "listening" | "pinyin" | "writing" | "speaking" | "sentences";

export const SKILLS: { id: Skill; label: string; icon: string }[] = [
  { id: "meaning", label: "Significado", icon: "义" },
  { id: "listening", label: "Escucha", icon: "听" },
  { id: "pinyin", label: "Pinyin y tonos", icon: "音" },
  { id: "writing", label: "Escritura", icon: "写" },
  { id: "speaking", label: "Pronunciación", icon: "说" },
  { id: "sentences", label: "Frases", icon: "句" },
];

/** A dictionary hit from any source. */
export interface DictEntry {
  hanzi: string;
  pinyin: string;
  meaning: string;
  source: "vocab" | "cedict";
  /** Vocab id when source === "vocab". */
  id?: string;
}

/** A lesson = all vocab entries sharing the same `lesson` date. */
export interface Lesson {
  id: string;
  /** 1-based position in chronological order. */
  number: number;
  words: VocabEntry[];
}
