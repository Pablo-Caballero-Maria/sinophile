/**
 * The few animations made with motion, shared so they feel alike: short, subtle, and only for
 * things that appear after an action (never prerendered content, which would stay hidden until
 * the JavaScript loads). With reduced motion asked by the system there are none (Providers.tsx).
 * The simple entrances (fade-in, pop, shake) stay CSS animations (globals.css).
 */
import type { Transition } from "motion/react";

/** A soft spring, without bounce. */
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 };

/** Fades in while rising a few pixels; fades out the same way. */
export const rise = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
} as const;

/** A sheet that slides up from the bottom edge and back down. */
export const sheet = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: SPRING,
} as const;

/** A small "pop" for an icon that confirms something. */
export const pop = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { ...SPRING, delay: 0.08 },
} as const;
