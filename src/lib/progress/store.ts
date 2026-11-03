"use client";
/**
 * Client-side progress store (localStorage) + the actions the UI calls.
 * On start it merges the committed data/progress.json seed and, if configured,
 * syncs with GitHub.
 */
import { useSyncExternalStore } from "react";
import { loadProgressSeed } from "../data/remote";
import { settingsStore, updateSettings } from "../settings";
import { createPersistentStore, useStore } from "../store";
import { newlyUnlocked, type Achievement, type SessionContext } from "./achievements";
import { emptyProgress, mergeProgress, recordAnswer, recordSession, reviveProgress, type Progress, type SessionSummaryInput } from "./model";
import { overwriteRemote, syncProgress } from "./sync";
import type { Skill } from "../types";

export const progressStore = createPersistentStore<Progress>("sinophile:progress:v1", emptyProgress(), reviveProgress);
export const useProgress = () => useStore(progressStore);

export const answer = (wordId: string, skill: Skill, correct: boolean, xp: number) =>
  progressStore.set((p) => recordAnswer(p, wordId, skill, correct, xp));

/** Records a finished session and returns the achievements it unlocked. */
export function finishSession(summary: SessionSummaryInput, context: SessionContext): Achievement[] {
  let unlocked: Achievement[] = [];
  progressStore.set((p) => {
    const next = recordSession(p, summary);
    unlocked = newlyUnlocked(next, context);
    if (unlocked.length === 0) return next;
    const now = new Date().toISOString();
    return { ...next, achievements: { ...next.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, now])) } };
  });
  void autoSync();
  return unlocked;
}

/* ───────────── sync status (in-memory) ───────────── */

export type SyncStatus = { state: "idle" | "syncing" | "ok" | "error"; message?: string };
let syncStatus: SyncStatus = { state: "idle" };
const statusListeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  syncStatus = s;
  statusListeners.forEach((l) => l());
};
export const useSyncStatus = () =>
  useSyncExternalStore(
    (l) => (statusListeners.add(l), () => statusListeners.delete(l)),
    () => syncStatus,
    () => syncStatus,
  );

/** Pull + merge + push now. Resolves with an error message or null. */
export async function syncNow(): Promise<string | null> {
  const config = settingsStore.get().sync;
  if (!config?.token) return "Configura primero la sincronización.";
  setStatus({ state: "syncing" });
  try {
    const merged = await syncProgress(config, progressStore.get());
    // Merge again in case the user practised while the request was in flight.
    progressStore.set((p) => mergeProgress(p, merged));
    updateSettings({ sync: { ...config, lastSync: new Date().toISOString() } });
    setStatus({ state: "ok" });
    return null;
  } catch (error) {
    const message = (error as Error).message;
    setStatus({ state: "error", message });
    return message;
  }
}

const autoSync = () => (settingsStore.get().sync?.auto ? syncNow() : Promise.resolve(null));

const SEEDED_KEY = "sinophile:seeded";
let booted = false;
/**
 * Called once by the app shell. On a device's very first visit the committed
 * data/progress.json is merged in (so a new iPad starts where you left off);
 * afterwards only the GitHub sync (if configured) brings remote progress.
 */
export async function bootProgress() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  try {
    if (!localStorage.getItem(SEEDED_KEY)) {
      const seed = await loadProgressSeed();
      if (seed) progressStore.set((p) => mergeProgress(p, reviveProgress(seed)));
      localStorage.setItem(SEEDED_KEY, "1");
    }
  } catch {
    /* storage unavailable */
  }
  await autoSync();
}

/** Replace local progress (import). */
export const replaceProgress = (p: Progress) => progressStore.set(p);

/** Wipes progress locally and, when sync is configured, also in GitHub. */
export async function resetProgress(): Promise<string | null> {
  const empty = { ...emptyProgress(), updatedAt: new Date().toISOString() };
  progressStore.set(empty);
  const config = settingsStore.get().sync;
  if (!config?.token) return null;
  try {
    await overwriteRemote(config, empty);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}
