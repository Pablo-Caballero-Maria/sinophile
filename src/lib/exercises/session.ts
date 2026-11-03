/**
 * Session state machine (pure; the player component performs side effects).
 *
 * answer → feedback → next … → done.  Wrong answers are re-queued once at the
 * end in learning modes (Duolingo-style); infinite mode has 3 lives; exams give
 * no feedback until the end.
 */
import type { AnswerResult, Exercise, SessionMode } from "./types";

export interface LogEntry {
  exercise: Exercise;
  result: AnswerResult;
}

export interface SessionState {
  mode: SessionMode;
  queue: Exercise[];
  index: number;
  phase: "answer" | "feedback" | "done";
  last: AnswerResult | null;
  /** XP of the last answer (for the feedback bar). */
  lastXp: number;
  combo: number;
  maxCombo: number;
  lives: number | null;
  xp: number;
  answered: number;
  correct: number;
  /** Keys of exercises already re-queued once. */
  retried: string[];
  log: LogEntry[];
  startedAt: number;
}

export type SessionAction =
  | { type: "answer"; result: AnswerResult }
  | { type: "next"; more?: Exercise }
  | { type: "skip" }
  | { type: "restart"; queue: Exercise[] };

const REQUEUE_MODES: SessionMode[] = ["leccion", "repaso", "escucha", "tonos", "frases"];
export const MAX_LIVES = 3;

export const initialSession = (mode: SessionMode, queue: Exercise[], now = Date.now()): SessionState => ({
  mode,
  queue,
  index: 0,
  phase: queue.length ? "answer" : "done",
  last: null,
  lastXp: 0,
  combo: 0,
  maxCombo: 0,
  lives: mode === "infinito" ? MAX_LIVES : null,
  xp: 0,
  answered: 0,
  correct: 0,
  retried: [],
  log: [],
  startedAt: now,
});

export const current = (s: SessionState): Exercise | undefined => s.queue[s.index];

/** XP for an answer given the state before it. */
export function xpFor(s: SessionState, exercise: Exercise, correct: boolean): number {
  if (!correct) return 0;
  if (exercise.type === "flashcard") return 5;
  const isRetry = s.queue.indexOf(exercise) !== s.index; // re-queued copy of an earlier failure
  const base = isRetry ? 5 : 10;
  const comboBonus = s.mode !== "examen" && s.combo + 1 >= 5 ? 5 : 0;
  return base + comboBonus;
}

export function sessionReducer(s: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "answer": {
      const exercise = current(s);
      if (!exercise || s.phase !== "answer") return s;
      const { correct } = action.result;
      const gained = xpFor(s, exercise, correct);
      const combo = correct ? s.combo + 1 : 0;
      const requeue = !correct && REQUEUE_MODES.includes(s.mode) && !s.retried.includes(exercise.key) && exercise.type !== "write" && exercise.type !== "speak";
      const lives = s.lives === null ? null : correct ? s.lives : s.lives - 1;
      const next: SessionState = {
        ...s,
        queue: requeue ? [...s.queue, exercise] : s.queue,
        retried: requeue ? [...s.retried, exercise.key] : s.retried,
        last: action.result,
        lastXp: gained,
        combo,
        maxCombo: Math.max(s.maxCombo, combo),
        lives,
        xp: s.xp + gained,
        answered: s.answered + 1,
        correct: s.correct + (correct ? 1 : 0),
        log: [...s.log, { exercise, result: action.result }],
        phase: "feedback",
      };
      // Exams move on silently; results are revealed at the end.
      return s.mode === "examen" ? advance(next) : next;
    }
    case "next":
      return advance(action.more ? { ...s, queue: [...s.queue, action.more] } : s);
    case "skip":
      return advance({ ...s, last: null });
    case "restart":
      return initialSession(s.mode, action.queue);
  }
}

function advance(s: SessionState): SessionState {
  const index = s.index + 1;
  const outOfLives = s.lives !== null && s.lives <= 0;
  const done = outOfLives || index >= s.queue.length;
  return { ...s, index: done ? s.index : index, phase: done ? "done" : "answer" };
}

/** Accuracy 0-100 over graded answers. */
export const accuracy = (s: SessionState): number => (s.answered ? Math.round((s.correct / s.answered) * 100) : 100);

/** Spanish 0-10 grade for exams, one decimal. */
export const examGrade = (s: SessionState): number => (s.answered ? Math.round((s.correct / s.answered) * 100) / 10 : 0);
