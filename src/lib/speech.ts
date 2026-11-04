"use client";
/**
 * Browser speech: Chinese text-to-speech (Web Speech synthesis) and speech
 * recognition for pronunciation practice (webkitSpeechRecognition where
 * available; otherwise the UI falls back to record-and-compare).
 */
import { settingsStore } from "./settings/store";

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Chinese voices, best first (Mandarin mainland, then others). */
export function chineseVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const rank = (v: SpeechSynthesisVoice) =>
    (/zh[-_]CN/i.test(v.lang) ? 0 : /cmn/i.test(v.lang) ? 1 : /zh[-_]TW/i.test(v.lang) ? 3 : 2) - (/google|premium|enhanced|tingting/i.test(v.name) ? 0.5 : 0);
  return speechSynthesis
    .getVoices()
    .filter((v) => /^(zh|cmn)/i.test(v.lang) && !/HK|yue/i.test(v.lang))
    .sort((a, b) => rank(a) - rank(b));
}

/** Calls back when the voice list is ready (it loads asynchronously in Chrome). */
export function onVoicesReady(callback: () => void): () => void {
  if (!ttsSupported()) return () => {};
  callback();
  speechSynthesis.addEventListener("voiceschanged", callback);
  return () => speechSynthesis.removeEventListener("voiceschanged", callback);
}

/** Speaks Chinese text. `slow` halves the configured rate. Resolves when finished. */
export function speak(text: string, { slow = false, lang = "zh-CN" } = {}): Promise<void> {
  if (!ttsSupported() || !text) return Promise.resolve();
  const { ttsRate, voiceURI } = settingsStore.get();
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = slow ? Math.max(0.4, ttsRate * 0.6) : ttsRate;
  if (lang.startsWith("zh")) {
    const voices = chineseVoices();
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];
    if (voice) utterance.voice = voice;
  }
  return new Promise((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}

/* ───────────── recognition ───────────── */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const recognitionSupported = () => recognitionCtor() !== null;

export interface Listening {
  /** Resolves with the recognised alternatives (best first); rejects with a Spanish message. */
  result: Promise<string[]>;
  stop(): void;
}

export function listen(lang = "zh-CN", timeoutMs = 7000): Listening {
  const Ctor = recognitionCtor();
  if (!Ctor) return { result: Promise.reject(new Error("Tu navegador no permite reconocimiento de voz.")), stop: () => {} };
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 5;
  let timer: ReturnType<typeof setTimeout>;
  const result = new Promise<string[]>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    recognition.onresult = (e) => {
      const first = e.results[0];
      const alternatives = Array.from({ length: first.length }, (_, i) => first[i].transcript.trim()).filter(Boolean);
      finish(() => resolve(alternatives));
    };
    recognition.onerror = (e) =>
      finish(() =>
        reject(
          new Error(
            e.error === "not-allowed" || e.error === "service-not-allowed"
              ? "Permiso de micrófono denegado."
              : e.error === "no-speech"
                ? "No he oído nada. Inténtalo de nuevo."
                : `Error de reconocimiento (${e.error}).`,
          ),
        ),
      );
    recognition.onend = () => finish(() => resolve([]));
    timer = setTimeout(() => recognition.stop(), timeoutMs);
    recognition.start();
  });
  return { result, stop: () => recognition.stop() };
}

/** Longest common subsequence length (for syllable similarity). */
function lcs(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

export interface PronunciationScore {
  /** 0..1 */
  score: number;
  heard: string;
  heardPinyin: string;
}

/**
 * Compares what the recogniser heard with the expected text: exact hanzi
 * match = 1, otherwise syllable overlap of the (toneless) pinyin of both.
 */
export async function scorePronunciation(expected: string, alternatives: string[]): Promise<PronunciationScore> {
  const { pinyin } = await import("pinyin-pro");
  const clean = (s: string) => s.replace(/[\p{P}\p{S}\s]/gu, "");
  const syllables = (s: string) => pinyin(clean(s), { toneType: "none", type: "array", v: true }) as string[];
  const target = syllables(expected);
  let best: PronunciationScore = { score: 0, heard: alternatives[0] ?? "", heardPinyin: "" };
  for (const alt of alternatives) {
    const score = clean(alt) === clean(expected) ? 1 : (2 * lcs(target, syllables(alt))) / (target.length + syllables(alt).length || 1);
    if (score > best.score || !best.heardPinyin) {
      best = { score, heard: alt, heardPinyin: pinyin(clean(alt), { toneType: "symbol" }) };
    }
    if (score === 1) break;
  }
  return best;
}
