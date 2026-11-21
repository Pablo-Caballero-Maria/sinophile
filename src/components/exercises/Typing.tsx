"use client";
/** Free typing: pinyin with tones (marks or numbers) or the Spanish meaning. */
import { useCallback, useRef, useState } from "react";
import { checkTyping } from "@/lib/exercises/check";
import type { Exercise } from "@/lib/exercises/types";
import { prettifyTyped } from "@/lib/pinyin";
import { CheckFooter, Instruction, PromptView, type ExerciseProps } from "./Common";

type Typing = Extract<Exercise, { type: "typing" }>;

const TONE_KEYS = [
  { digit: "1", mark: "ˉ" },
  { digit: "2", mark: "ˊ" },
  { digit: "3", mark: "ˇ" },
  { digit: "4", mark: "ˋ" },
];

export function TypingExercise({ exercise: ex, answered, onAnswer }: ExerciseProps<Typing>) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const check = useCallback(() => value.trim() && onAnswer(checkTyping(ex, value)), [ex, onAnswer, value]);
  const pinyin = ex.mode === "pinyin";

  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <PromptView prompt={ex.prompt} revealed={answered} />
      <input
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={answered}
        placeholder={pinyin ? "p. ej. ni3 hao3" : "Escribe en español…"}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        lang={pinyin ? "zh-Latn" : "es"}
        className="mt-6 w-full rounded-2xl border-2 border-line bg-surface px-4 py-4 text-xl outline-none focus:border-sky"
      />
      {pinyin && (
        <div className="mt-3 flex items-center gap-2">
          {TONE_KEYS.map(({ digit, mark }) => (
            <button
              key={digit}
              type="button"
              disabled={answered}
              onClick={() => {
                setValue((v) => v + digit);
                input.current?.focus();
              }}
              className="h-11 w-11 rounded-xl border-2 border-b-4 border-line bg-surface text-xl font-bold"
              aria-label={`Tono ${digit}`}
            >
              {mark}
            </button>
          ))}
          <span className="ml-2 text-lg font-semibold text-sky">
            {/\d/.test(value) ? prettifyTyped(value) : ""}
          </span>
        </div>
      )}
      <CheckFooter answered={answered} disabled={!value.trim()} onCheck={check} />
    </>
  );
}
