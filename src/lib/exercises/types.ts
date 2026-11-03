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

export type Exercise =
  | (Base & { type: "intro"; word: VocabEntry; note?: string; example?: Sentence })
  | (Base & { type: "choice"; prompt: Prompt; options: Option[]; answerId: string; explanation?: string })
  | (Base & { type: "match"; pairs: { wordId: string; left: Display; right: Display }[] })
  | (Base & { type: "tiles"; prompt: Prompt; lang: "zh" | "es"; tiles: string[]; answers: string[]; solution: string })
  | (Base & { type: "typing"; prompt: Prompt; mode: "pinyin" | "es"; answers: string[]; solution: string })
  | (Base & { type: "write"; word: VocabEntry; guided: boolean })
  | (Base & { type: "speak"; hanzi: string; pinyin: string; translation: string })
  | (Base & { type: "flashcard"; word: VocabEntry; reverse: boolean });

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
}
