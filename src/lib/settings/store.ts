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

export const useSettings = () => useStore(settingsStore);

export const updateSettings = (patch: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

/** Applies the theme attribute (read by globals.css). */
export function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
