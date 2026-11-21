"use client";
/**
 * Pronunciation: listen to the model, then speak. With speech recognition the
 * result is scored automatically (syllable match); without it, the learner
 * records themselves, compares with the model and self-assesses.
 */
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Exercise } from "@/lib/exercises/types";
import { listen, recognitionSupported, scorePronunciation, type PronunciationScore } from "@/lib/speech";
import { Hanzi, Pinyin, SpeakButton } from "../hanzi";
import { Button, cn } from "../ui";
import { Footer, Instruction, type ExerciseProps } from "./common";

type Speak = Extract<Exercise, { type: "speak" }>;

const PASS = 0.75;
const MAX_ATTEMPTS = 3;

function Recognizer({
  ex,
  answered,
  onAnswer,
}: {
  ex: Speak;
  answered: boolean;
  onAnswer: ExerciseProps<Speak>["onAnswer"];
}) {
  const [status, setStatus] = useState<"idle" | "listening" | "scoring">("idle");
  const [score, setScore] = useState<PronunciationScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const start = async () => {
    setError(null);
    setStatus("listening");
    try {
      const alternatives = await listen().result;
      setStatus("scoring");
      const s = await scorePronunciation(ex.hanzi, alternatives);
      setAttempts((a) => a + 1);
      setScore(s);
      if (s.score >= PASS) onAnswer({ correct: true, given: s.heard, note: `Te he entendido: ${s.heard}` });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  };

  const exhausted = attempts >= MAX_ATTEMPTS && (score?.score ?? 0) < PASS;
  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <button
        type="button"
        disabled={answered || status !== "idle"}
        onClick={() => void start()}
        className={cn(
          "grid h-24 w-24 place-items-center rounded-full border-b-[6px] text-white transition-transform active:translate-y-1",
          status === "listening" ? "animate-pulse border-bad-strong bg-bad" : "border-brand-strong bg-brand",
          "disabled:opacity-60",
        )}
        aria-label="Hablar"
      >
        <Mic size={40} />
      </button>
      <p className="text-sm font-semibold text-muted">
        {status === "listening"
          ? "Te escucho… habla ahora"
          : status === "scoring"
            ? "Evaluando…"
            : "Pulsa el micrófono y lee en voz alta"}
      </p>
      {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      {score && (
        <div
          className={cn(
            "w-full rounded-2xl p-4 text-center",
            score.score >= PASS ? "bg-ok-soft" : "bg-gold-soft",
          )}
        >
          <p className="text-sm text-muted">He entendido:</p>
          <p lang="zh-CN" className="font-hanzi text-2xl">
            {score.heard || "—"}
          </p>
          {score.heardPinyin && <p className="text-sm text-muted">{score.heardPinyin}</p>}
          <p className="mt-1 font-bold">{Math.round(score.score * 100)}% de coincidencia</p>
        </div>
      )}
      {exhausted && !answered && (
        <Button
          variant="secondary"
          onClick={() =>
            onAnswer({
              correct: false,
              given: score?.heard,
              note: "Sigue practicando: escucha el modelo despacio 🐢",
            })
          }
        >
          Continuar
        </Button>
      )}
    </div>
  );
}

/** Fallback without recognition: record, play back, self-assess. */
function Recorder({ answered, onAnswer }: { answered: boolean; onAnswer: ExerciseProps<Speak>["onAnswer"] }) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("No puedo acceder al micrófono.");
    }
  };
  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
  };

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <button
        type="button"
        disabled={answered}
        onClick={() => void (recording ? stop() : start())}
        className={cn(
          "grid h-24 w-24 place-items-center rounded-full border-b-[6px] text-white",
          recording ? "animate-pulse border-bad-strong bg-bad" : "border-brand-strong bg-brand",
        )}
        aria-label={recording ? "Parar" : "Grabar"}
      >
        {recording ? <Square size={36} /> : <Mic size={40} />}
      </button>
      <p className="text-sm font-semibold text-muted">
        {recording ? "Grabando… pulsa para parar" : "Graba tu voz y compárala con el modelo"}
      </p>
      {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      {url && (
        <>
          <audio src={url} controls className="w-full max-w-sm" />
          {!answered && (
            <div className="flex w-full gap-3">
              <Button variant="bad" className="flex-1" onClick={() => onAnswer({ correct: false })}>
                Necesito practicar
              </Button>
              <Button variant="ok" className="flex-1" onClick={() => onAnswer({ correct: true })}>
                Me ha salido bien
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SpeakExercise({ exercise: ex, answered, onAnswer, onSkip }: ExerciseProps<Speak>) {
  const [canRecognize] = useState(recognitionSupported);
  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <div className="flex flex-col items-center gap-2 text-center">
        <Hanzi text={ex.hanzi} pinyin={ex.pinyin} className={ex.hanzi.length > 4 ? "text-4xl" : "text-7xl"} />
        <Pinyin text={ex.pinyin} className="text-xl font-semibold" />
        <p className="text-muted">{ex.translation}</p>
        <SpeakButton text={ex.hanzi} className="mt-2" />
      </div>
      {canRecognize ? (
        <Recognizer ex={ex} answered={answered} onAnswer={onAnswer} />
      ) : (
        <Recorder answered={answered} onAnswer={onAnswer} />
      )}
      <Footer hidden={answered}>
        <Button variant="ghost" full onClick={onSkip}>
          Ahora no puedo hablar
        </Button>
      </Footer>
    </>
  );
}
