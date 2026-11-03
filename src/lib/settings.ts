"use client";
/** User preferences (per device, localStorage). */
import { createPersistentStore, useStore } from "./store";

export interface SyncConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  /** Fine-grained GitHub token with Contents read/write on the repo. Never leaves this device except to api.github.com. */
  token: string;
  /** Pull on start and push after each session. */
  auto: boolean;
  lastSync?: string;
}

export interface Settings {
  /** Daily XP goal */
  dailyGoal: number;
  theme: "auto" | "light" | "dark";
  sound: boolean;
  /** Speech rate for Chinese TTS (0.5 - 1.2) */
  ttsRate: number;
  voiceURI: string | null;
  /** Show pinyin under hanzi in exercise prompts */
  showPinyin: boolean;
  /** Colour hanzi/pinyin by tone (Trainchinese-style) */
  toneColors: boolean;
  /** Drawing canvases ignore finger touches once a pencil is used */
  penOnly: boolean;
  autoplayAudio: boolean;
  /** Exercises per lesson/review session */
  sessionLength: number;
  /** Include pronunciation (microphone) exercises in lessons */
  speakingInLessons: boolean;
  sync: SyncConfig | null;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 50,
  theme: "auto",
  sound: true,
  ttsRate: 0.85,
  voiceURI: null,
  showPinyin: true,
  toneColors: true,
  penOnly: true,
  autoplayAudio: true,
  sessionLength: 15,
  speakingInLessons: false,
  sync: null,
};

export const settingsStore = createPersistentStore<Settings>("sinophile:settings:v1", DEFAULT_SETTINGS, (raw) => ({
  ...DEFAULT_SETTINGS,
  ...(typeof raw === "object" && raw ? (raw as Partial<Settings>) : {}),
}));

export const useSettings = () => useStore(settingsStore);

export const updateSettings = (patch: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

/** Applies the theme attribute (read by globals.css). */
export function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** Inline script for <head>: sets the theme before first paint (no flash). */
export const THEME_BOOT_SCRIPT = `try{var t=JSON.parse(localStorage.getItem("sinophile:settings:v1")||"{}").theme;if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
