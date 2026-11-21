"use client";
/** Pieces shared by the writing exercises. */
import type { Exercise } from "@/lib/exercises/types";
import { cn } from "../UI";

export type Write = Extract<Exercise, { type: "write" }>;

/** Square size that fits phones and iPads. */
export const boxSize = () =>
  typeof window === "undefined"
    ? 300
    : Math.round(Math.min(340, window.innerWidth - 48, window.innerHeight * 0.5));

/** Which character of the word is being written. */
export function CharDots({ total, index }: { total: number; index: number }) {
  if (total < 2) return null;
  return (
    <div className="mb-3 flex justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn("h-2 w-6 rounded-full", i < index ? "bg-ok" : i === index ? "bg-sky" : "bg-line")}
        />
      ))}
    </div>
  );
}
