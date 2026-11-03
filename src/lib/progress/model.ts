/**
 * Progress model: what is stored in localStorage and synced to data/progress.json,
 * plus pure functions to update it and derive stats (XP, streak, level, mastery).
 *
 * Merge-friendly by design: totals are derived from per-day buckets and
 * per-item timestamps, so two devices can be merged with max / last-writer-wins.
 */
import { review, strength, isDue, type ItemState } from "../srs.ts";
import { addDays, dayKey } from "../text.ts";
import type { Lesson, Skill, VocabEntry } from "../types.ts";

export interface DayStats {
  xp: number;
  answered: number;
  correct: number;
  sessions: number;
  /** milliseconds practised */
  ms: number;
}

export interface LessonStats {
  sessions: number;
  /** best accuracy 0-100 */
  best: number;
  /** last practised day */
  last: string;
}

export interface ExamRecord {
  id: string;
  date: string;
  lessons: string[];
  total: number;
  correct: number;
  /** Spanish 0-10 scale */
  grade: number;
  ms: number;
}

export interface Progress {
  version: 1;
  updatedAt: string;
  days: Record<string, DayStats>;
  /** key: `${wordId}:${skill}` */
  items: Record<string, ItemState>;
  lessons: Record<string, LessonStats>;
  exams: ExamRecord[];
  records: { infinite: number; combo: number };
  /** achievement id -> ISO date unlocked */
  achievements: Record<string, string>;
}

/** Skills that count towards a word's mastery (speaking/sentences are optional extras). */
export const CORE_SKILLS: Skill[] = ["meaning", "listening", "pinyin", "writing"];

export const emptyProgress = (): Progress => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  days: {},
  items: {},
  lessons: {},
  exams: [],
  records: { infinite: 0, combo: 0 },
  achievements: {},
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Tolerant parse of stored/remote JSON into a Progress (unknown fields dropped). */
export function reviveProgress(raw: unknown): Progress {
  const base = emptyProgress();
  if (!isObj(raw)) return base;
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    days: isObj(raw.days) ? (raw.days as Progress["days"]) : {},
    items: isObj(raw.items) ? (raw.items as Progress["items"]) : {},
    lessons: isObj(raw.lessons) ? (raw.lessons as Progress["lessons"]) : {},
    exams: Array.isArray(raw.exams) ? (raw.exams as ExamRecord[]) : [],
    records: { ...base.records, ...(isObj(raw.records) ? (raw.records as Partial<Progress["records"]>) : {}) },
    achievements: isObj(raw.achievements) ? (raw.achievements as Progress["achievements"]) : {},
  };
}

const maxBy = <T>(a: T | undefined, b: T | undefined, pickA: (a: T, b: T) => boolean): T | undefined =>
  a === undefined ? b : b === undefined ? a : pickA(a, b) ? a : b;

/** Combines two progress snapshots (e.g. local + GitHub) without losing work. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const days: Progress["days"] = { ...a.days };
  for (const [day, s] of Object.entries(b.days)) {
    const o = days[day];
    days[day] = o
      ? {
          xp: Math.max(o.xp, s.xp),
          answered: Math.max(o.answered, s.answered),
          correct: Math.max(o.correct, s.correct),
          sessions: Math.max(o.sessions, s.sessions),
          ms: Math.max(o.ms, s.ms),
        }
      : s;
  }
  const items: Progress["items"] = { ...a.items };
  for (const [key, item] of Object.entries(b.items)) items[key] = maxBy(items[key], item, (x, y) => x.t >= y.t)!;
  const lessons: Progress["lessons"] = { ...a.lessons };
  for (const [id, l] of Object.entries(b.lessons)) {
    const o = lessons[id];
    lessons[id] = o
      ? { sessions: Math.max(o.sessions, l.sessions), best: Math.max(o.best, l.best), last: o.last > l.last ? o.last : l.last }
      : l;
  }
  const exams = [...a.exams, ...b.exams.filter((e) => !a.exams.some((x) => x.id === e.id))].sort((x, y) =>
    x.date.localeCompare(y.date),
  );
  const achievements: Progress["achievements"] = { ...b.achievements, ...a.achievements };
  for (const [id, date] of Object.entries(b.achievements)) if (date < achievements[id]) achievements[id] = date;
  return {
    version: 1,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
    days,
    items,
    lessons,
    exams,
    records: { infinite: Math.max(a.records.infinite, b.records.infinite), combo: Math.max(a.records.combo, b.records.combo) },
    achievements,
  };
}

/* ───────────── updates (pure: return a new object) ───────────── */

const itemKey = (wordId: string, skill: Skill) => `${wordId}:${skill}`;
const emptyDay = (): DayStats => ({ xp: 0, answered: 0, correct: 0, sessions: 0, ms: 0 });
const touch = (p: Progress): Progress => ({ ...p, updatedAt: new Date().toISOString() });

export function recordAnswer(p: Progress, wordId: string, skill: Skill, correct: boolean, xp: number, today = dayKey()): Progress {
  const key = itemKey(wordId, skill);
  const day = p.days[today] ?? emptyDay();
  return touch({
    ...p,
    items: { ...p.items, [key]: review(p.items[key], correct, today) },
    days: { ...p.days, [today]: { ...day, xp: day.xp + xp, answered: day.answered + 1, correct: day.correct + (correct ? 1 : 0) } },
  });
}

export interface SessionSummaryInput {
  lessonId?: string;
  accuracy: number;
  ms: number;
  xpBonus: number;
  maxCombo: number;
  infiniteScore?: number;
  exam?: ExamRecord;
}

export function recordSession(p: Progress, s: SessionSummaryInput, today = dayKey()): Progress {
  const day = p.days[today] ?? emptyDay();
  const lessons = { ...p.lessons };
  if (s.lessonId) {
    const prev = lessons[s.lessonId];
    lessons[s.lessonId] = { sessions: (prev?.sessions ?? 0) + 1, best: Math.max(prev?.best ?? 0, Math.round(s.accuracy)), last: today };
  }
  return touch({
    ...p,
    days: { ...p.days, [today]: { ...day, xp: day.xp + s.xpBonus, sessions: day.sessions + 1, ms: day.ms + s.ms } },
    lessons,
    exams: s.exam ? [...p.exams, s.exam] : p.exams,
    records: {
      infinite: Math.max(p.records.infinite, s.infiniteScore ?? 0),
      combo: Math.max(p.records.combo, s.maxCombo),
    },
  });
}

/* ───────────── derived stats ───────────── */

export const totalXp = (p: Progress): number => Object.values(p.days).reduce((sum, d) => sum + d.xp, 0);

export function streakInfo(p: Progress, today = dayKey()): { current: number; best: number; practicedToday: boolean } {
  const active = (d: string) => (p.days[d]?.xp ?? 0) > 0;
  const practicedToday = active(today);
  let current = 0;
  for (let d = practicedToday ? today : addDays(today, -1); active(d); d = addDays(d, -1)) current++;
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of Object.keys(p.days).filter(active).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), practicedToday };
}

/** XP needed to reach `level` (1-based): 0, 100, 300, 600, 1000… */
export const xpForLevel = (level: number): number => 50 * level * (level - 1);

export function levelInfo(xp: number): { level: number; into: number; span: number; ratio: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const into = xp - xpForLevel(level);
  const span = xpForLevel(level + 1) - xpForLevel(level);
  return { level, into, span, ratio: into / span };
}

export const itemOf = (p: Progress, wordId: string, skill: Skill): ItemState | undefined => p.items[itemKey(wordId, skill)];

/** 0..1 average strength over the core skills. */
export const wordMastery = (p: Progress, wordId: string): number =>
  CORE_SKILLS.reduce((sum, skill) => sum + strength(itemOf(p, wordId, skill)), 0) / CORE_SKILLS.length;

const ALL_SKILLS: Skill[] = ["meaning", "listening", "pinyin", "writing", "speaking", "sentences"];

export const isSeen = (p: Progress, wordId: string): boolean => ALL_SKILLS.some((s) => p.items[itemKey(wordId, s)]);

/** A word counts as learned once its meaning reached box 2 (answered right on two separate occasions). */
export const isLearned = (p: Progress, wordId: string): boolean => (itemOf(p, wordId, "meaning")?.b ?? 0) >= 2;

export function skillMastery(p: Progress, words: VocabEntry[], skill: Skill): number {
  if (words.length === 0) return 0;
  return words.reduce((sum, w) => sum + strength(itemOf(p, w.id, skill)), 0) / words.length;
}

export function lessonMastery(p: Progress, lesson: Lesson): number {
  if (lesson.words.length === 0) return 0;
  return lesson.words.reduce((sum, w) => sum + wordMastery(p, w.id), 0) / lesson.words.length;
}

/** 0-3 stars: 1 = every word seen, 2 = solid (≥ 1/3 mastery), 3 = long-term (≥ 2/3). */
export function lessonStars(p: Progress, lesson: Lesson): number {
  if (!lesson.words.every((w) => isSeen(p, w.id))) return 0;
  const m = lessonMastery(p, lesson);
  return m >= 2 / 3 ? 3 : m >= 1 / 3 ? 2 : 1;
}

export interface DueItem {
  wordId: string;
  skill: Skill;
  item: ItemState;
}

/** Items due for review today (only for words still present in the vocabulary). */
export function dueItems(p: Progress, vocabIds: Set<string>, today = dayKey()): DueItem[] {
  return Object.entries(p.items)
    .map(([key, item]) => {
      const sep = key.lastIndexOf(":");
      return { wordId: key.slice(0, sep), skill: key.slice(sep + 1) as Skill, item };
    })
    .filter((d) => vocabIds.has(d.wordId) && isDue(d.item, today))
    .sort((a, b) => a.item.d.localeCompare(b.item.d) || a.item.b - b.item.b);
}

/** Correct answers per skill (all time). */
export function correctBySkill(p: Progress): Record<Skill, number> {
  const out = { meaning: 0, listening: 0, pinyin: 0, writing: 0, speaking: 0, sentences: 0 } as Record<Skill, number>;
  for (const [key, item] of Object.entries(p.items)) {
    const skill = key.slice(key.lastIndexOf(":") + 1) as Skill;
    if (skill in out) out[skill] += item.c;
  }
  return out;
}
