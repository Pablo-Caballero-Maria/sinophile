/**
 * Spaced repetition (Leitner boxes) per word × skill.
 *
 * Box 0..6. A correct answer moves the item up one box and schedules the next
 * review INTERVALS[box] days later; a wrong answer drops it two boxes and makes
 * it due today. Items that are not yet due can only climb while still in the
 * "learning" boxes (< LEARNING_BOXES), so cramming in one day can't fake
 * long-term mastery.
 */
import { addDays } from "./text.ts";

/** Compact on purpose: thousands of these live in progress.json. */
export interface ItemState {
  /** box */
  b: number;
  /** next due day (YYYY-MM-DD) */
  d: string;
  /** times seen */
  s: number;
  /** times correct */
  c: number;
  /** last review timestamp (ms), used for merge conflict resolution */
  t: number;
}

export const MAX_BOX = 6;
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
const LEARNING_BOXES = 2;

export function review(state: ItemState | undefined, correct: boolean, today: string, now = Date.now()): ItemState {
  const prev = state ?? { b: 0, d: today, s: 0, c: 0, t: 0 };
  const due = prev.d <= today;
  let box = prev.b;
  if (correct && (due || box < LEARNING_BOXES)) box = Math.min(MAX_BOX, box + 1);
  if (!correct) box = Math.max(0, box - 2);
  const promoted = box > prev.b;
  const next = correct ? (promoted || due ? addDays(today, INTERVALS[box]) : prev.d) : today;
  return { b: box, d: next, s: prev.s + 1, c: prev.c + (correct ? 1 : 0), t: now };
}

export const isDue = (state: ItemState | undefined, today: string): boolean =>
  !!state && state.s > 0 && state.d <= today;

/** 0..1 */
export const strength = (state: ItemState | undefined): number => (state ? state.b / MAX_BOX : 0);
