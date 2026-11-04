"use client";
/**
 * One-off migration from the first version of the app, which kept progress
 * and settings in localStorage. Nothing is written to browser storage any
 * more: this module only reads the old keys so their content can be moved to
 * an account, and then deletes them.
 */
import { reviveProgress, isEmptyProgress, type Progress } from "../progress/model";
import { sanitizeSettings, type Settings } from "../settings/model";

const KEYS = { progress: "sinophile:progress:v1", settings: "sinophile:settings:v1", seeded: "sinophile:seeded" };

/**
 * In the first version the only lesson was dated 2026-11-03; it is really the
 * class of 2026-10-26 (now data/2026-10-26/), so its stats move there.
 */
const RENAMED_LESSONS: Record<string, string> = { "2026-11-03": "2026-10-26" };

/** Applies RENAMED_LESSONS to the per-lesson stats and exam scopes. Pure. */
export function upgradeLegacyProgress(p: Progress): Progress {
  const rename = (id: string) => RENAMED_LESSONS[id] ?? id;
  return {
    ...p,
    lessons: Object.fromEntries(Object.entries(p.lessons).map(([id, stats]) => [rename(id), stats])),
    exams: p.exams.map((e) => ({ ...e, lessons: e.lessons.map(rename) })),
  };
}

export interface LegacyData {
  progress: Progress;
  settings: Settings;
}

/** The old localStorage data, or null when there is none (or nothing was practised). */
export function readLegacyData(): LegacyData | null {
  try {
    const raw = localStorage.getItem(KEYS.progress);
    if (!raw) return null;
    const progress = upgradeLegacyProgress(reviveProgress(JSON.parse(raw)));
    if (isEmptyProgress(progress)) {
      clearLegacyData();
      return null;
    }
    const settings = sanitizeSettings(JSON.parse(localStorage.getItem(KEYS.settings) ?? "null"));
    return { progress, settings };
  } catch {
    return null; // storage blocked or corrupted
  }
}

export function clearLegacyData(): void {
  try {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage blocked */
  }
}
