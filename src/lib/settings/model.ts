/**
 * User preferences: shape, defaults and validation (zod). Pure (shared by the browser
 * and the API, which stores them with the account).
 */
import { z } from "../zod.ts";

export interface Settings {
  /** Daily XP goal */
  dailyGoal: number;
  /** Light unless the learner picks dark (accounts from before 1.2 may say "auto": read as light). */
  theme: "light" | "dark";
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
  theme: "light",
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

/** Each setting checked on its own: a wrong or missing value falls back to its default. */
const settingsSchema = z
  .object({
    dailyGoal: z.number().min(1).max(1000).transform(Math.round).catch(DEFAULT_SETTINGS.dailyGoal),
    // Anything but "dark" (e.g. "auto", from before 1.2) is the default, light.
    theme: z.enum(["light", "dark"]).catch(DEFAULT_SETTINGS.theme),
    sound: z.boolean().catch(DEFAULT_SETTINGS.sound),
    ttsRate: z.number().min(0.5).max(1.2).catch(DEFAULT_SETTINGS.ttsRate),
    voiceURI: z.string().max(300).nullable().catch(null),
    showPinyin: z.boolean().catch(DEFAULT_SETTINGS.showPinyin),
    toneColors: z.boolean().catch(DEFAULT_SETTINGS.toneColors),
    penOnly: z.boolean().catch(DEFAULT_SETTINGS.penOnly),
    autoplayAudio: z.boolean().catch(DEFAULT_SETTINGS.autoplayAudio),
    sessionLength: z.number().min(5).max(50).transform(Math.round).catch(DEFAULT_SETTINGS.sessionLength),
    speakingInLessons: z.boolean().catch(DEFAULT_SETTINGS.speakingInLessons),
    silentMode: z.boolean().catch(DEFAULT_SETTINGS.silentMode),
  })
  .catch(() => ({ ...DEFAULT_SETTINGS })) satisfies z.ZodType<Settings>;

/** Keeps only known, well-typed values; anything else falls back to the default. */
export const sanitizeSettings = (raw: unknown): Settings => settingsSchema.parse(raw);
