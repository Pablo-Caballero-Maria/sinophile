/**
 * Shared domain types. The JSON files in data/lección N/ follow these shapes;
 * see data/instructions.txt for the human/LLM-facing description.
 */

/** One word as written by hand in data/lección N/vocab.json (plus the lesson it belongs to). */
export interface VocabEntry {
  /** Unique across all lessons (progress is stored per id). */
  id: string;
  hanzi: string;
  pinyin: string;
  /** Spanish meaning(s). Several meanings may be separated by "/", ";" or ",". */
  es: string;
  /** Id of its lesson (the lesson number as text, "1", "2"…). Comes from the folder, not from the file. */
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
      /** Other valid translations: Spanish sentences (zh-es) or Chinese ones (es-zh). */
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

/** A lesson = one class = one data/lección N/ folder. */
export interface Lesson {
  /** The lesson number as text ("1", "2"…): used in URLs and stored progress. */
  id: string;
  /** Folder name inside data/ ("lección 1"). */
  folder: string;
  /** The number in the folder name; lessons are shown in this order. */
  number: number;
  words: VocabEntry[];
}
