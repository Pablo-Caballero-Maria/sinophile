/**
 * The vocabulary of every lesson folder (data/<date>/vocab.json) is bundled at
 * build time by scripts/prepare-data.ts (every push to GitHub rebuilds the
 * site), so lessons and words are available instantly without a fetch.
 */
import bundle from "@/generated/lessons.json";
import type { Lesson, VocabEntry } from "../types.ts";
import { sanitizeLessons, type LessonBundle } from "./validate.ts";

const parsed = sanitizeLessons(bundle as LessonBundle);

export const VOCAB: VocabEntry[] = parsed.entries;
export const VOCAB_ISSUES = parsed.issues;
export const VOCAB_BY_ID = new Map(VOCAB.map((w) => [w.id, w]));
export const VOCAB_IDS = new Set(VOCAB_BY_ID.keys());

/** Lessons in chronological order (by folder date). */
export const LESSONS: Lesson[] = parsed.lessons;

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

/** Vocabulary entries whose hanzi is exactly `hanzi`. */
export const vocabByHanzi = (hanzi: string): VocabEntry[] => VOCAB.filter((w) => w.hanzi === hanzi);

/** Words of the given lessons (all words when the list is empty). */
export const wordsOfLessons = (lessonIds: string[]): VocabEntry[] =>
  lessonIds.length === 0 ? VOCAB : VOCAB.filter((w) => lessonIds.includes(w.lesson));
