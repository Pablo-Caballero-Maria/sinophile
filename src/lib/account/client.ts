"use client";
/**
 * Account state in the browser: guest mode vs. signed-in user.
 *
 * - On start (bootAccount) the app asks the server who is signed in (the
 *   session is Better Auth's HttpOnly cookie) and loads that account's progress
 *   and settings into the in-memory stores.
 * - Signed in: every local change to progress/settings is uploaded in the
 *   background (only the changed part of the progress, see diffProgress).
 * - Guest: everything stays in memory and is lost when the page is closed.
 *   When a guest signs in or signs up, what they practised can be added to the
 *   account.
 * Nothing is written to browser storage.
 */
import {
  diffProgress,
  emptyProgress,
  isEmptyProgress,
  mergeProgress,
  type Progress,
} from "../progress/model";
import { progressStore } from "../progress/store";
import { DEFAULT_SETTINGS, type Settings } from "../settings/model";
import { settingsStore } from "../settings/store";
import { createStore, useStore } from "../store";
import { api, ApiError } from "./api";
import { auth } from "./auth-client";
import { Saver, type SaveStatus } from "./saver";
import type { AccountPayload, Credentials } from "./types";

export interface AccountState {
  /**
   * loading: first request in flight · guest: not signed in · user: signed in ·
   * offline: the server could not be reached (works like guest mode).
   */
  status: "loading" | "guest" | "user" | "offline";
  username: string | null;
  /** Upload state of the signed-in user's changes. */
  save: SaveStatus;
  /** The session ended while the app was open (e.g. it expired or the account was deleted elsewhere). */
  expired: boolean;
}

export const accountStore = createStore<AccountState>({
  status: "loading",
  username: null,
  save: "idle",
  expired: false,
});
export const useAccount = () => useStore(accountStore);
/** False during prerender and until the account (or guest mode) is loaded: pages show skeletons meanwhile. */
export const useReady = () => useAccount().status !== "loading";

const update = (patch: Partial<AccountState>) => accountStore.set((s) => ({ ...s, ...patch }));
const signedIn = () => accountStore.get().status === "user";

/* ───────────── background saving ───────────── */

/** Network problems, server errors and conflicts are retried; other answers would fail again. */
const retryable = (error: unknown) =>
  !(error instanceof ApiError) ||
  error.status === 0 ||
  error.status >= 500 ||
  error.status === 409 ||
  error.status === 429;

function onSaveStatus(_status: SaveStatus, error?: unknown) {
  if (error instanceof ApiError && error.status === 401) return sessionEnded();
  const all = [progressSaver.status, settingsSaver.status];
  update({
    save: all.includes("error")
      ? "error"
      : all.includes("saving")
        ? "saving"
        : all.includes("pending")
          ? "pending"
          : "idle",
  });
}

const progressSaver = new Saver<Progress>({
  send: (patch, keepalive) => api.saveProgress(patch, keepalive),
  combine: mergeProgress,
  shouldRetry: retryable,
  onStatus: onSaveStatus,
});

const settingsSaver = new Saver<Settings>({
  send: (settings, keepalive) => api.saveSettings(settings, keepalive),
  combine: (_older, newer) => newer,
  delayMs: 800,
  shouldRetry: retryable,
  onStatus: onSaveStatus,
});

progressStore.onChange((next, prev) => {
  if (signedIn()) progressSaver.push(diffProgress(prev, next));
});
settingsStore.onChange((next) => {
  if (signedIn()) settingsSaver.push(next);
});

function flushOnExit() {
  if (!signedIn()) return;
  progressSaver.flushOnExit();
  settingsSaver.flushOnExit();
}

/* ───────────── state transitions ───────────── */

let lastFetch = 0;

function enterAccount(payload: AccountPayload) {
  progressSaver.clear();
  settingsSaver.clear();
  progressStore.load(payload.progress ?? emptyProgress());
  settingsStore.load(payload.settings ?? DEFAULT_SETTINGS);
  update({ status: "user", username: payload.user?.username ?? null, expired: false, save: "idle" });
  lastFetch = Date.now();
}

/** Leaves the account but keeps what is on screen, so it can be added back after signing in again. */
function sessionEnded() {
  progressSaver.clear();
  settingsSaver.clear();
  update({ status: "guest", username: null, expired: true, save: "idle" });
}

function resetToGuest() {
  progressSaver.clear();
  settingsSaver.clear();
  progressStore.load(emptyProgress());
  settingsStore.load(DEFAULT_SETTINGS);
  update({ status: "guest", username: null, expired: false, save: "idle" });
}

/* ───────────── start-up ───────────── */

let booted = false;

/** Called once by the app shell. */
export async function bootAccount(): Promise<void> {
  if (booted || typeof window === "undefined") return;
  booted = true;
  window.addEventListener("pagehide", flushOnExit);
  document.addEventListener("visibilitychange", () =>
    document.visibilityState === "hidden" ? flushOnExit() : void refresh(),
  );

  try {
    const payload = await api.account();
    if (payload.user) enterAccount(payload);
    else update({ status: "guest" });
  } catch {
    update({ status: "offline" });
  }
}

/**
 * When the app comes back to the foreground: picks up what was practised on
 * other devices, or retries the connection after an offline start.
 */
export async function refresh(): Promise<void> {
  const state = accountStore.get();
  if (state.status === "offline") return reconnect();
  if (state.status !== "user" || Date.now() - lastFetch < 60_000) return;
  lastFetch = Date.now();
  try {
    const payload = await api.account();
    if (!payload.user) return sessionEnded();
    if (payload.user.username !== state.username) return enterAccount(payload); // another account signed in elsewhere in this browser
    progressStore.load(mergeProgress(progressStore.get(), payload.progress ?? emptyProgress()));
    if (!settingsSaver.busy && payload.settings) settingsStore.load(payload.settings);
  } catch {
    /* offline for now: try again next time */
  }
}

/** Retries after an offline start; what was practised meanwhile is added to the account. */
export async function reconnect(): Promise<void> {
  const local = progressStore.get();
  try {
    const payload = await api.account();
    if (!payload.user) return update({ status: "guest" });
    enterAccount(payload);
    if (!isEmptyProgress(local)) progressStore.set((p) => mergeProgress(p, local));
  } catch {
    /* still offline */
  }
}

/* ───────────── actions ───────────── */

/** What a guest practised, to add to an account. */
const guestProgress = (adopt: boolean): Progress | undefined => {
  const local = progressStore.get();
  return adopt && !isEmptyProgress(local) ? local : undefined;
};

/**
 * Enters the account that was just signed in to. What the guest practised (`progress`) and, for a
 * new account, their settings are then changes like any other: uploaded in the background.
 */
async function enterSignedIn(progress: Progress | undefined, settings?: Settings): Promise<void> {
  enterAccount(await api.account());
  if (settings) settingsStore.set(settings);
  if (progress) progressStore.set((p) => mergeProgress(p, progress));
}

/** Signs in. With `adopt`, what was practised as a guest is added to the account. */
export async function signIn(credentials: Credentials, adopt: boolean): Promise<void> {
  const progress = guestProgress(adopt);
  await auth.signIn(credentials);
  await enterSignedIn(progress);
}

/** Creates an account with the current settings (and, with `adopt`, the current progress). */
export async function signUp(credentials: Credentials, adopt: boolean): Promise<void> {
  const progress = guestProgress(adopt);
  const settings = settingsStore.get();
  await auth.signUp(credentials);
  await enterSignedIn(progress, settings);
}

/** Uploads pending changes, ends the session and goes back to an empty guest mode. */
export async function signOut(): Promise<void> {
  await Promise.all([progressSaver.flush(), settingsSaver.flush()]);
  await auth.signOut();
  resetToGuest();
}

/** Deletes the account and its progress (the password is asked again to avoid accidents). */
export async function deleteAccount(password: string): Promise<void> {
  await auth.deleteAccount(password);
  resetToGuest();
}

/** Wipes the progress (in the account too when signed in). */
export async function resetProgress(): Promise<void> {
  if (signedIn()) {
    progressSaver.clear();
    await api.resetProgress();
  }
  progressStore.load(emptyProgress());
}

/** Adds an imported backup to the current progress (and to the account when signed in). */
export const importProgress = (incoming: Progress) => progressStore.set((p) => mergeProgress(p, incoming));
