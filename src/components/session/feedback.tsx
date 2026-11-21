"use client";
/** Bottom sheet shown after each answer (green/red), Duolingo-style. */
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnswerResult } from "@/lib/exercises/types";
import { hasHan, pick } from "@/lib/text";
import { Hanzi } from "../hanzi";
import { Button, cn } from "../ui";

const PRAISE = [
  "¡Correcto!",
  "¡Muy bien!",
  "¡Genial!",
  "¡Perfecto!",
  "¡Excelente!",
  "¡Así se hace!",
  "¡太好了!",
];

export function FeedbackBar({
  result,
  xp,
  onContinue,
}: {
  result: AnswerResult;
  xp: number;
  onContinue: () => void;
}) {
  const [praise] = useState(() => pick(PRAISE));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        onContinue();
      }
    };
    // Delay so the Enter that submitted the answer doesn't also skip the feedback.
    const timer = setTimeout(() => window.addEventListener("keydown", onKey), 150);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onContinue]);

  const ok = result.correct;
  return (
    <div
      className={cn(
        "pb-safe fixed inset-x-0 bottom-0 z-40 animate-slide-up border-t-2",
        ok ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft",
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-full text-white",
              ok ? "bg-ok" : "bg-bad",
            )}
          >
            {ok ? <Check size={28} strokeWidth={3} /> : <X size={28} strokeWidth={3} />}
          </span>
          <div className={cn("min-w-0", ok ? "text-ok" : "text-bad")}>
            <p className="text-xl font-black">
              {ok ? praise : result.solution ? "Respuesta correcta:" : "¡Casi!"}
              {xp > 0 && <span className="ml-2 align-middle text-sm font-bold text-gold">+{xp} XP</span>}
            </p>
            {!ok &&
              result.solution &&
              (hasHan(result.solution) ? (
                <Hanzi text={result.solution} className="text-2xl" />
              ) : (
                <p className="text-lg font-semibold">{result.solution}</p>
              ))}
            {!ok && result.given && (
              <p className="truncate text-sm opacity-80">Tu respuesta: {result.given}</p>
            )}
            {result.note && <p className="text-sm font-medium opacity-90">{result.note}</p>}
          </div>
        </div>
        <Button variant={ok ? "ok" : "bad"} size="lg" className="sm:w-48" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
