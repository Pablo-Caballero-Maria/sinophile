/**
 * Progress model: what is stored with each account (MongoDB, see src/server/),
 * plus pure functions to update it and derive stats (XP, streak, level, mastery).
 *
 * Merge-friendly by design: totals are derived from per-day buckets and
 * per-item timestamps, so two devices (or a partial update, see diffProgress)
 * can be merged with max / last-writer-wins.
 */
import { MAX_BOX, review, strength, isDue, type ItemState } from "../srs.ts";
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

/* ───────────── parsing untrusted JSON (API bodies, stored documents, imported files) ───────────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Keys are stored as MongoDB field names: no ".", no "$". */
const SAFE_KEY_RE = /^[A-Za-z0-9_-]{1,100}$/;
const ITEM_KEY_RE = /^[A-Za-z0-9_-]{1,100}:(meaning|listening|pinyin|writing|speaking|sentences)$/;
const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const clamp = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, count(v)));
const shortText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;

function reviveMap<T>(raw: unknown, keyRe: RegExp, revive: (value: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const parsed = keyRe.test(key) ? revive(value) : null;
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}

const reviveDay = (v: unknown): DayStats | null =>
  isObj(v) ? { xp: count(v.xp), answered: count(v.answered), correct: count(v.correct), sessions: count(v.sessions), ms: count(v.ms) } : null;

const reviveItem = (v: unknown): ItemState | null =>
  isObj(v) && typeof v.d === "string" && DAY_RE.test(v.d)
    ? { b: Math.round(clamp(v.b, 0, MAX_BOX)), d: v.d, s: count(v.s), c: count(v.c), t: count(v.t) }
    : null;

const reviveLesson = (v: unknown): LessonStats | null =>
  isObj(v) && typeof v.last === "string" && DAY_RE.test(v.last) ? { sessions: count(v.sessions), best: clamp(v.best, 0, 100), last: v.last } : null;

function reviveExam(v: unknown): ExamRecord | null {
  if (!isObj(v) || !shortText(v.id) || !shortText(v.date)) return null;
  const lessons = Array.isArray(v.lessons) ? v.lessons.filter(shortText) : [];
  return { id: v.id, date: v.date, lessons, total: count(v.total), correct: count(v.correct), grade: clamp(v.grade, 0, 10), ms: count(v.ms) };
}

/**
 * Strict, tolerant parse of untrusted JSON into a Progress: malformed entries
 * and unsafe keys are dropped, unknown fields ignored. Never throws.
 */
export function reviveProgress(raw: unknown): Progress {
  const base = emptyProgress();
  if (!isObj(raw)) return base;
  const exams = Array.isArray(raw.exams) ? raw.exams.map(reviveExam).filter((e): e is ExamRecord => e !== null) : [];
  const records = isObj(raw.records) ? raw.records : {};
  return {
    version: 1,
    updatedAt: shortText(raw.updatedAt) ? raw.updatedAt : base.updatedAt,
    days: reviveMap(raw.days, DAY_RE, reviveDay),
    items: reviveMap(raw.items, ITEM_KEY_RE, reviveItem),
    lessons: reviveMap(raw.lessons, SAFE_KEY_RE, reviveLesson),
    exams,
    records: { infinite: count(records.infinite), combo: count(records.combo) },
    achievements: reviveMap(raw.achievements, SAFE_KEY_RE, (v) => (shortText(v) ? v : null)),
  };
}

/** True when nothing has been practised yet. */
export const isEmptyProgress = (p: Progress): boolean =>
  [p.days, p.items, p.lessons, p.achievements].every((m) => Object.keys(m).length === 0) &&
  p.exams.length === 0 &&
  p.records.infinite === 0 &&
  p.records.combo === 0;

/**
 * The part of `next` that changed since `prev` (entries are compared by
 * reference: the update functions below only replace what they touch).
 * Merging the result into a copy of `prev` with mergeProgress gives `next`,
 * which is how the app saves progress without uploading the whole document.
 */
export function diffProgress(prev: Progress, next: Progress): Progress {
  const changed = <V>(a: Record<string, V>, b: Record<string, V>) => Object.fromEntries(Object.entries(b).filter(([k, v]) => a[k] !== v));
  const known = new Set(prev.exams.map((e) => e.id));
  return {
    version: 1,
    updatedAt: next.updatedAt,
    days: changed(prev.days, next.days),
    items: changed(prev.items, next.items),
    lessons: changed(prev.lessons, next.lessons),
    exams: next.exams.filter((e) => !known.has(e.id)),
    records: next.records,
    achievements: changed(prev.achievements, next.achievements),
  };
}

const maxBy = <T>(a: T | undefined, b: T | undefined, pickA: (a: T, b: T) => boolean): T | undefined =>
  a === undefined ? b : b === undefined ? a : pickA(a, b) ? a : b;

/** Combines two progress snapshots (two devices, or a stored document and a change) without losing work. */
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

/** Ungraded practice (free drawing): counts for the daily goal and the streak, not for accuracy or spaced repetition. */
export function recordPractice(p: Progress, xp: number, today = dayKey()): Progress {
  const day = p.days[today] ?? emptyDay();
  return touch({ ...p, days: { ...p.days, [today]: { ...day, xp: day.xp + xp } } });
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
