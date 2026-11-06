"use client";
/** Short synthesised UI sounds (Web Audio, no audio files). */
import { settingsStore } from "./settings/store";

type SoundName = "correct" | "wrong" | "complete" | "tap";

const NOTES: Record<SoundName, [frequency: number, start: number, duration: number][]> = {
  correct: [
    [660, 0, 0.12],
    [880, 0.1, 0.18],
  ],
  wrong: [
    [220, 0, 0.18],
    [180, 0.12, 0.22],
  ],
  complete: [
    [523, 0, 0.14],
    [659, 0.12, 0.14],
    [784, 0.24, 0.14],
    [1047, 0.36, 0.3],
  ],
  tap: [[520, 0, 0.05]],
};

let ctx: AudioContext | null = null;

export function playSound(name: SoundName) {
  const { sound, silentMode } = settingsStore.get();
  if (typeof window === "undefined" || !sound || silentMode) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const [freq, start, duration] of NOTES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === "wrong" ? "sawtooth" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(name === "wrong" ? 0.06 : 0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    }
  } catch {
    /* audio not available */
  }
}
