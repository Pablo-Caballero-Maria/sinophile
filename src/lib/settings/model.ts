/**
 * User preferences: shape, defaults and validation. Pure (shared by the browser
 * and the API, which stores them with the account).
 */

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
  /** Practising around other people: no listening or pronunciation exercises and no sound at all */
  silentMode: boolean;
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
  silentMode: false,
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Keeps only known, well-typed values; anything else falls back to the default. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isObj(raw)) return { ...d };
  return {
    dailyGoal: inRange(raw.dailyGoal, 1, 1000) ? Math.round(raw.dailyGoal) : d.dailyGoal,
    theme: raw.theme === "light" || raw.theme === "dark" || raw.theme === "auto" ? raw.theme : d.theme,
    sound: bool(raw.sound, d.sound),
    ttsRate: inRange(raw.ttsRate, 0.5, 1.2) ? raw.ttsRate : d.ttsRate,
    voiceURI: typeof raw.voiceURI === "string" && raw.voiceURI.length <= 300 ? raw.voiceURI : null,
    showPinyin: bool(raw.showPinyin, d.showPinyin),
    toneColors: bool(raw.toneColors, d.toneColors),
    penOnly: bool(raw.penOnly, d.penOnly),
    autoplayAudio: bool(raw.autoplayAudio, d.autoplayAudio),
    sessionLength: inRange(raw.sessionLength, 5, 50) ? Math.round(raw.sessionLength) : d.sessionLength,
    speakingInLessons: bool(raw.speakingInLessons, d.speakingInLessons),
    silentMode: bool(raw.silentMode, d.silentMode),
  };
}
