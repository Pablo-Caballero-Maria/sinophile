"use client";
/** Multiple choice: meaning, reverse, listening, tones, fill-in-the-blank, dialogues, questions. */
import { useCallback, useEffect, useState } from "react";
import { checkChoice } from "@/lib/exercises/check";
import type { Exercise } from "@/lib/exercises/types";
import { speak } from "@/lib/speech";
import { cn } from "../ui";
import { CheckFooter, DisplayView, Instruction, optionClass, PromptView, type ExerciseProps } from "./common";

type Choice = Extract<Exercise, { type: "choice" }>;

export function ChoiceExercise({ exercise: ex, answered, onAnswer }: ExerciseProps<Choice>) {
  const [selected, setSelected] = useState<string | null>(null);
  const hanziGrid = ex.options.every((o) => o.display.kind === "hanzi" && o.display.text.length <= 4);
  const speakOnSelect = ex.prompt.kind === "text";

  const choose = useCallback(
    (id: string) => {
      if (answered) return;
      setSelected(id);
      const option = ex.options.find((o) => o.id === id);
      if (speakOnSelect && option?.display.kind === "hanzi") void speak(option.display.text);
    },
    [answered, ex.options, speakOnSelect],
  );

  // Keyboard shortcuts 1-4 (desktop / iPad keyboard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= ex.options.length && !(e.target instanceof HTMLInputElement))
        choose(ex.options[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, ex.options]);

  const check = useCallback(() => selected && onAnswer(checkChoice(ex, selected)), [ex, onAnswer, selected]);
  const filled =
    ex.prompt.kind === "sentence" && selected
      ? ex.options.find((o) => o.id === selected)?.display.text
      : undefined;

  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <PromptView prompt={ex.prompt} revealed={answered} filled={filled} />
      <div className={cn("mt-6 grid gap-3", hanziGrid ? "grid-cols-2" : "grid-cols-1")}>
        {ex.options.map((o, i) => {
          const state = answered
            ? o.id === ex.answerId
              ? "correct"
              : o.id === selected
                ? "wrong"
                : "dim"
            : o.id === selected
              ? "selected"
              : "idle";
          return (
            <button
              key={o.id}
              type="button"
              disabled={answered}
              onClick={() => choose(o.id)}
              className={cn(
                optionClass(state),
                "relative flex min-h-16 items-center justify-center text-center",
              )}
            >
              <span className="absolute top-2 left-3 hidden text-xs font-bold text-muted sm:block">
                {i + 1}
              </span>
              <DisplayView display={o.display} revealPinyin={answered} large={hanziGrid} />
            </button>
          );
        })}
      </div>
      <CheckFooter answered={answered} disabled={!selected} onCheck={check} />
    </>
  );
}
