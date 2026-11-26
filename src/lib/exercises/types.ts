/** Runtime exercise model consumed by the session player and the exercise components. */
import type { Sentence, Skill, VocabEntry } from "../types";

/** Something shown as a prompt or option. */
export type Display =
  | { kind: "hanzi"; text: string; pinyin?: string }
  | { kind: "text"; text: string }
  | { kind: "pinyin"; text: string };

export interface Option {
  id: string;
  display: Display;
}

export type Prompt =
  /** Big hanzi of a word, with speaker button. */
  | { kind: "word"; word: VocabEntry; showPinyin: boolean }
  /** Spanish text or a question. */
  | { kind: "text"; text: string }
  /** Hidden text to listen to; revealed after answering. */
  | { kind: "audio"; speak: string; reveal: Sentence | VocabEntry }
  /** A Chinese sentence, optionally with a blank and a translation hint. */
  | { kind: "sentence"; sentence: Sentence; blank?: number; showTranslation: boolean };

interface Base {
  /** Unique within a session. */
  key: string;
  skill: Skill;
  /** Words credited (SRS) when this exercise is graded. */
  wordIds: string[];
  /** Spanish instruction shown above the exercise. */
  instruction: string;
}

/**
 * How a hanzi is written:
 *  - guided: traced over the outline, with the stroke order checked live;
 *  - free: drawn from memory with no evaluation (the hanzi is revealed afterwards);
 *  - graded: drawn from memory and corrected automatically (exams need a mark).
 */
export type WriteStyle = "guided" | "free" | "graded";

export type Exercise =
  | (Base & { type: "intro"; word: VocabEntry; note?: string; example?: Sentence })
  | (Base & { type: "choice"; prompt: Prompt; options: Option[]; answerId: string; explanation?: string })
  | (Base & { type: "match"; pairs: { wordId: string; left: Display; right: Display }[] })
  | (Base & {
      type: "tiles";
      prompt: Prompt;
      lang: "zh" | "es";
      tiles: string[];
      answers: string[];
      solution: string;
    })
  | (Base & { type: "typing"; prompt: Prompt; mode: "pinyin" | "es"; answers: string[]; solution: string })
  | (Base & { type: "write"; word: VocabEntry; style: WriteStyle })
  | (Base & { type: "speak"; hanzi: string; pinyin: string; translation: string })
  | (Base & { type: "flashcard"; word: VocabEntry; front: CardFront });

export type ExerciseType = Exercise["type"];

/** What an exercise component reports when the learner answers. */
export interface AnswerResult {
  correct: boolean;
  /** Learner's answer as text (for feedback / exam review). */
  given?: string;
  /** Correct solution as text. */
  solution?: string;
  /** Extra feedback line ("¡Ojo con los tonos!"). */
  note?: string;
  /** Per-word correctness (match exercises); overrides `correct` for SRS. */
  perWord?: Record<string, boolean>;
}

export type SessionMode =
  | "leccion"
  | "repaso"
  | "infinito"
  | "examen"
  | "escritura"
  | "tarjetas"
  | "escucha"
  | "pronunciacion"
  | "tonos"
  | "frases";

/**
 * What the front of a flashcard shows; the back shows the rest (hanzi, pinyin, Spanish and the
 * pronunciation button). "audio" plays the word, so it's left out in silent mode.
 */
export type CardFront = "es" | "hanzi" | "pinyin" | "audio";

export const CARD_FRONTS: readonly CardFront[] = ["es", "hanzi", "pinyin", "audio"];

export interface SessionParams {
  mode: SessionMode;
  /** Lesson ids (empty = all). */
  lessons: string[];
  /** Specific word ids (overrides lessons). */
  words: string[];
  /** Number of exercises (exam, flashcards…). */
  count?: number;
  /** Writing style. */
  style?: "guiado" | "libre" | "mixto";
  /** Exam includes free writing. */
  withWriting?: boolean;
  /** Flashcards: the face to show first; without it, a mix of every available face. */
  front?: CardFront;
}
