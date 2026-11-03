"use client";
/**
 * Runs a practice session: builds the exercise queue, renders the current
 * exercise, records every answer (SRS + XP), shows feedback and the summary.
 */
import { Flame, Heart, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useState } from "react";
import { VOCAB, VOCAB_BY_ID, wordsOfLessons } from "@/lib/data/vocab";
import { buildSession, nextInfinite, type GenContext } from "@/lib/exercises/generate";
import { current, initialSession, MAX_LIVES, sessionReducer, xpFor } from "@/lib/exercises/session";
import type { AnswerResult, SessionMode, SessionParams } from "@/lib/exercises/types";
import { answer, progressStore } from "@/lib/progress/store";
import { useSettings } from "@/lib/settings";
import { playSound } from "@/lib/sound";
import { recognitionSupported } from "@/lib/speech";
import type { VocabEntry, WordSet } from "@/lib/types";
import { ExerciseView } from "../exercises";
import { Button, ButtonLink, cn, EmptyState, ProgressBar } from "../ui";
import { FeedbackBar } from "./feedback";
import { SessionSummary } from "./summary";

export const MODE_TITLES: Record<SessionMode, string> = {
  leccion: "Lección",
  repaso: "Repaso",
  infinito: "Modo infinito",
  examen: "Examen",
  escritura: "Escritura",
  tarjetas: "Tarjetas",
  escucha: "Escucha",
  pronunciacion: "Pronunciación",
  tonos: "Tonos",
  frases: "Frases",
};

const EMPTY_MESSAGES: Partial<Record<SessionMode, string>> = {
  repaso: "Aún no has practicado ninguna palabra. ¡Empieza una lección!",
  frases: "Estas palabras todavía no tienen frases en exercises.json.",
};

const speechInputSupported = () =>
  recognitionSupported() || (typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);

export function selectWords(params: SessionParams): VocabEntry[] {
  if (params.words.length) return params.words.map((id) => VOCAB_BY_ID.get(id)).filter((w): w is VocabEntry => !!w);
  return wordsOfLessons(params.lessons);
}

export function exitHrefFor(params: SessionParams) {
  if (params.lessons.length === 1) return `/leccion?id=${params.lessons[0]}`;
  if (params.words.length === 1) return `/palabra?id=${encodeURIComponent(params.words[0])}`;
  return params.mode === "leccion" ? "/" : "/practicar";
}

export function SessionRunner({ params, sets, onRestart }: { params: SessionParams; sets: Record<string, WordSet>; onRestart: () => void }) {
  const settings = useSettings();
  const router = useRouter();
  const [words] = useState(() => selectWords(params));
  const [ctx] = useState<GenContext>(() => ({
    vocab: VOCAB,
    sets,
    progress: progressStore.get(),
    showPinyin: settings.showPinyin,
    speaking: params.mode === "pronunciacion" || (settings.speakingInLessons && speechInputSupported()),
    sessionLength: settings.sessionLength,
    random: Math.random,
  }));
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => initialSession(params.mode, buildSession(params, words, ctx)));
  const [confirmExit, setConfirmExit] = useState(false);
  const exercise = current(state);
  const exitHref = exitHrefFor(params);

  const onAnswer = useCallback(
    (result: AnswerResult) => {
      if (!exercise || state.phase !== "answer") return;
      const xp = xpFor(state, exercise, result.correct);
      exercise.wordIds.forEach((id, i) => answer(id, exercise.skill, result.perWord?.[id] ?? result.correct, i === 0 ? xp : 0));
      playSound(params.mode === "examen" ? "tap" : result.correct ? "correct" : "wrong");
      dispatch({ type: "answer", result });
    },
    [exercise, params.mode, state],
  );

  const onContinue = useCallback(() => {
    const more = params.mode === "infinito" ? nextInfinite(words, { ...ctx, progress: progressStore.get() }) : undefined;
    dispatch({ type: "next", more });
  }, [ctx, params.mode, words]);

  const onSkip = useCallback(() => {
    if (params.mode === "infinito") dispatch({ type: "next", more: nextInfinite(words, { ...ctx, progress: progressStore.get() }) });
    else dispatch({ type: "skip" });
  }, [ctx, params.mode, words]);

  const exit = useCallback(() => (state.answered === 0 ? router.push(exitHref) : setConfirmExit(true)), [exitHref, router, state.answered]);

  // Every new exercise starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 }); // (scrollTo returns a Promise in recent browsers: don't return it)
  }, [state.index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  if (state.queue.length === 0)
    return (
      <div className="mx-auto max-w-2xl px-4 pt-16">
        <EmptyState icon="🎉" title="Nada que practicar aquí">
          {EMPTY_MESSAGES[params.mode] ?? "No hay palabras para esta selección."}
        </EmptyState>
        <ButtonLink href={exitHref} full>
          Volver
        </ButtonLink>
      </div>
    );

  if (state.phase === "done") return <SessionSummary state={state} params={params} exitHref={exitHref} onRestart={onRestart} />;

  const finite = state.lives === null;
  const progress = (state.index + (state.phase === "feedback" ? 1 : 0)) / state.queue.length;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-bg/95" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          <button type="button" onClick={exit} aria-label="Salir" className="rounded-xl p-1 text-muted hover:bg-surface-2">
            <X size={28} />
          </button>
          {finite ? (
            <ProgressBar value={progress} className="h-4 flex-1" />
          ) : (
            <div className="flex flex-1 items-center gap-1">
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <Heart key={i} size={26} className={i < (state.lives ?? 0) ? "fill-brand text-brand" : "text-line"} />
              ))}
              <span className="ml-auto text-lg font-black text-gold">{state.correct}</span>
            </div>
          )}
          {state.combo >= 3 && params.mode !== "examen" && (
            <span key={state.combo} className="animate-pop rounded-full bg-gold-soft px-2 py-0.5 text-sm font-black text-gold">
              <Flame size={14} className="inline fill-gold align-[-2px]" /> {state.combo}
            </span>
          )}
        </div>
        {params.mode === "examen" && (
          <p className="mx-auto max-w-2xl px-4 text-sm font-semibold text-muted">
            Pregunta {state.index + 1} de {state.queue.length}
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-48 pt-4">
        {exercise && (
          <div key={`${exercise.key}-${state.index}`} className="animate-fade-in">
            <ExerciseView exercise={exercise} answered={state.phase === "feedback"} onAnswer={onAnswer} onSkip={onSkip} />
          </div>
        )}
      </main>

      {state.phase === "feedback" && state.last && <FeedbackBar result={state.last} xp={state.lastXp} onContinue={onContinue} />}

      {confirmExit && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center" onClick={() => setConfirmExit(false)}>
          <div className="pb-safe mx-auto w-full max-w-md animate-slide-up rounded-t-3xl bg-surface p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-xl font-black">¿Salir de la sesión?</p>
            <p className="mt-1 text-muted">Lo que ya has respondido queda guardado, pero no recibirás el resumen ni las bonificaciones.</p>
            <div className={cn("mt-5 flex flex-col gap-3")}>
              <Button size="lg" full onClick={() => setConfirmExit(false)}>
                Seguir practicando
              </Button>
              <Button variant="ghost" full onClick={() => router.push(exitHref)}>
                Salir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
