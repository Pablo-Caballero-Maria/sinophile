"use client";
/**
 * User preferences in memory. Signed-in users get them from their account and
 * every change is saved there (lib/account/client.ts); guests start with the
 * defaults and keep their changes until the page is closed.
 */
import { createStore, useStore } from "../store";
import { DEFAULT_SETTINGS, type Settings } from "./model";

export type { Settings } from "./model";

export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS);

/** The settings in a component; with a selector, only that part (e.g. `(s) => s.theme`). */
export function useSettings(): Settings;
export function useSettings<S>(select: (settings: Settings) => S): S;
export function useSettings<S>(select?: (settings: Settings) => S): Settings | S {
  return useStore<Settings, Settings | S>(settingsStore, select ?? ((settings) => settings));
}

export const updateSettings = (patch: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

export { applyTheme } from "./theme";
