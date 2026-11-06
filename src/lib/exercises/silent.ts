/**
 * Silent mode, for practising around other people: exercises that need sound,
 * either to hear it (listening) or to make it (pronunciation), are left out.
 * The app's own audio is muted in lib/speech.ts and lib/sound.ts.
 */
import type { Skill } from "../types";
import type { Exercise, SessionMode } from "./types";

const NOISY_SKILLS: readonly Skill[] = ["listening", "speaking"];
/** Modes made only of such exercises, so they have nothing to offer in silent mode. */
const NOISY_MODES: readonly SessionMode[] = ["escucha", "pronunciacion"];

export const isNoisyMode = (mode: SessionMode): boolean => NOISY_MODES.includes(mode);
export const isNoisyExercise = (exercise: Exercise): boolean => NOISY_SKILLS.includes(exercise.skill);

/** The due review items that can be practised right now. */
export const reviewable = <T extends { skill: Skill }>(due: T[], silent: boolean): T[] =>
  silent ? due.filter((d) => !NOISY_SKILLS.includes(d.skill)) : due;
