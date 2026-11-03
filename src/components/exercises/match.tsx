"use client";
/** Matching game: tap a hanzi, then its meaning/pinyin. Completes itself when all pairs match. */
import { useRef, useState } from "react";
import type { Exercise } from "@/lib/exercises/types";
import { playSound } from "@/lib/sound";
import { speak } from "@/lib/speech";
import { shuffle } from "@/lib/text";
import { cn } from "../ui";
import { DisplayView, Instruction, optionClass, type ExerciseProps } from "./common";

type Match = Extract<Exercise, { type: "match" }>;

export function MatchExercise({ exercise: ex, answered, onAnswer }: ExerciseProps<Match>) {
  // Shuffled once per mount (the component is keyed by exercise).
  const [left] = useState(() => shuffle(ex.pairs));
  const [right] = useState(() => shuffle(ex.pairs));
  const [pickLeft, setPickLeft] = useState<string | null>(null);
  const [pickRight, setPickRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const mistakes = useRef(new Set<string>());

  const attempt = (l: string | null, r: string | null) => {
    if (!l || !r) return;
    if (l === r) {
      const next = [...matched, l];
      setMatched(next);
      playSound("tap");
      if (next.length === ex.pairs.length) {
        const perWord = Object.fromEntries(ex.pairs.map((p) => [p.wordId, !mistakes.current.has(p.wordId)]));
        onAnswer({ correct: mistakes.current.size === 0, perWord, note: mistakes.current.size ? `${mistakes.current.size} pareja(s) con fallos.` : undefined });
      }
    } else {
      mistakes.current.add(l).add(r);
      setWrong([l, r]);
      playSound("wrong");
      setTimeout(() => setWrong([]), 450);
    }
    setPickLeft(null);
    setPickRight(null);
  };

  const stateOf = (id: string, picked: string | null, side: 0 | 1) =>
    matched.includes(id) ? "dim" : wrong[side] === id ? "wrong" : picked === id ? "selected" : "idle";

  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {left.map((p) => (
            <button
              key={p.wordId}
              type="button"
              disabled={answered || matched.includes(p.wordId)}
              onClick={() => {
                if (p.left.kind === "hanzi") void speak(p.left.text);
                setPickLeft(p.wordId);
                attempt(p.wordId, pickRight);
              }}
              className={cn(optionClass(stateOf(p.wordId, pickLeft, 0)), "min-h-16")}
            >
              <DisplayView display={p.left} />
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {right.map((p) => (
            <button
              key={p.wordId}
              type="button"
              disabled={answered || matched.includes(p.wordId)}
              onClick={() => {
                setPickRight(p.wordId);
                attempt(pickLeft, p.wordId);
              }}
              className={cn(optionClass(stateOf(p.wordId, pickRight, 1)), "min-h-16 text-center")}
            >
              <DisplayView display={p.right} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
