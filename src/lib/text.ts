/**
 * Small text and randomness helpers shared across the app.
 * (No path-alias imports: also used by Node build scripts.)
 */

const HAN_RE = /\p{Script=Han}/u;
const PUNCT_RE = /^[\p{P}\p{S}\s]+$/u;

export const hasHan = (text: string): boolean => HAN_RE.test(text);

/** Han characters of a string, in order (duplicates kept). */
export const hanChars = (text: string): string[] => [...text].filter((c) => HAN_RE.test(c));

/** True for tokens made only of punctuation/symbols/spaces ("，", "。", "!"). */
export const isPunctuation = (token: string): boolean => PUNCT_RE.test(token);

/** Lowercase, accent-free, punctuation-free, single-spaced. "¡Hola, Él!" -> "hola el". */
export function normalizeLatin(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chinese text without punctuation or spaces, for answer comparison. */
export const normalizeZh = (text: string): string => text.replace(/[\p{P}\p{S}\s]/gu, "");

/** Splits a Spanish gloss into its alternative meanings: "amigo / amiga; colega". */
export function splitMeanings(es: string): string[] {
  return es
    .split(/[/;,]/)
    .map((m) => m.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
}

/** Spanish words of a sentence, without punctuation: "¡Hola, Ana!" -> ["Hola", "Ana"]. */
export const spanishWords = (sentence: string): string[] =>
  sentence
    .replace(/[¡!¿?.,;:"«»()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Seedable PRNG (mulberry32) so sessions can be reproduced in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const pick = <T>(items: readonly T[], random = Math.random): T =>
  items[Math.floor(random() * items.length)];

/** `count` distinct random items. */
export const sample = <T>(items: readonly T[], count: number, random = Math.random): T[] =>
  shuffle(items, random).slice(0, count);

export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Local date as YYYY-MM-DD (the app's "day" unit). */
export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds days to a YYYY-MM-DD key. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-03" -> "3 nov 2026" */
export function formatDay(key: string, withYear = true): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}
