"use client";
/**
 * Progress in memory + the actions the UI calls. Signed-in users get it from
 * their account and every change is saved there by lib/account/client.ts
 * (which listens to this store); guests practise without saving.
 */
import { createStore, useStore } from "../store";
import { newlyUnlocked, type Achievement, type SessionContext } from "./achievements";
import { emptyProgress, recordAnswer, recordPractice, recordSession, type Progress, type SessionSummaryInput } from "./model";
import type { Skill } from "../types";

export const progressStore = createStore<Progress>(emptyProgress());
export const useProgress = () => useStore(progressStore);

export const answer = (wordId: string, skill: Skill, correct: boolean, xp: number) =>
  progressStore.set((p) => recordAnswer(p, wordId, skill, correct, xp));

export const addPracticeXp = (xp: number) => progressStore.set((p) => recordPractice(p, xp));

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
  return unlocked;
}
