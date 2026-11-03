"use client";
/**
 * Writing hanzi, one character at a time:
 *  - guided: Hanzi Writer quiz over the outline, checking stroke order live;
 *  - free: blank grid; when done, the drawing is graded against the reference
 *    strokes and the real character + stroke-order animation are revealed.
 */
import { Eraser, Eye, Undo2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { gradeDrawing, type DrawingGrade } from "@/lib/drawing";
import type { Exercise } from "@/lib/exercises/types";
import { loadStrokes, type StrokeData } from "@/lib/strokes";
import { hanChars } from "@/lib/text";
import { DrawingCanvas, type DrawingCanvasHandle } from "../drawing-canvas";
import { CharacterSvg, HanziQuiz, Pinyin, SpeakButton, StrokeOrder, themeColor } from "../hanzi";
import { Button, cn } from "../ui";
import { Footer, Instruction, type ExerciseProps } from "./common";

type Write = Extract<Exercise, { type: "write" }>;

/** Square size that fits phones and iPads. */
const boxSize = () => (typeof window === "undefined" ? 300 : Math.round(Math.min(340, window.innerWidth - 48, window.innerHeight * 0.5)));

function CharDots({ total, index }: { total: number; index: number }) {
  if (total < 2) return null;
  return (
    <div className="mb-3 flex justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-2 w-6 rounded-full", i < index ? "bg-ok" : i === index ? "bg-sky" : "bg-line")} />
      ))}
    </div>
  );
}

function WordHeader({ ex }: { ex: Write }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-3">
      <SpeakButton text={ex.word.hanzi} size="sm" slow={false} />
      <div className="text-center">
        <Pinyin text={ex.word.pinyin} className="block text-lg font-semibold" />
        <span className="text-muted">{ex.word.es}</span>
      </div>
    </div>
  );
}

function GuidedWrite({ exercise: ex, answered, onAnswer, onSkip }: ExerciseProps<Write>) {
  const chars = hanChars(ex.word.hanzi);
  const [index, setIndex] = useState(0);
  const [demo, setDemo] = useState(false);
  const totals = useRef({ mistakes: 0, strokes: 0 });
  const [size] = useState(boxSize);

  const done = useCallback(
    (mistakes: number, strokes: number) => {
      totals.current.mistakes += mistakes;
      totals.current.strokes += strokes;
      if (index < chars.length - 1) {
        setTimeout(() => setIndex((i) => i + 1), 500);
        return;
      }
      const { mistakes: m, strokes: s } = totals.current;
      onAnswer({ correct: m <= Math.max(2, Math.round(s * 0.2)), note: m === 0 ? "¡Sin un solo error de trazo!" : `${m} trazo(s) mal colocados.` });
    },
    [chars.length, index, onAnswer],
  );

  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <WordHeader ex={ex} />
      <CharDots total={chars.length} index={answered ? chars.length : index} />
      <div className="flex justify-center">
        {demo ? <StrokeOrder key={`demo-${index}`} char={chars[index]} size={size} /> : <HanziQuiz key={index} char={chars[index]} size={size} onComplete={done} />}
      </div>
      <Footer hidden={answered}>
        <Button variant="ghost" onClick={onSkip}>
          Ahora no puedo
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setDemo((d) => !d)}>
          <Eye size={18} /> {demo ? "Volver a escribir" : "Ver orden de trazos"}
        </Button>
      </Footer>
    </>
  );
}

function FreeWrite({ exercise: ex, answered, onAnswer, onSkip }: ExerciseProps<Write>) {
  const chars = hanChars(ex.word.hanzi);
  const [index, setIndex] = useState(0);
  const [strokeCount, setStrokeCount] = useState(0);
  const [result, setResult] = useState<{ grade: DrawingGrade; data: StrokeData; colors: string[] } | null>(null);
  const passed = useRef<boolean[]>([]);
  const canvas = useRef<DrawingCanvasHandle>(null);
  const [size] = useState(boxSize);
  const isLast = index === chars.length - 1;

  const check = async () => {
    const data = await loadStrokes(chars[index]);
    const grade = gradeDrawing(canvas.current?.strokes() ?? [], size, data.medians);
    const drawn = canvas.current?.strokes().length ?? 0;
    const colors = Array.from({ length: drawn }, (_, i) => themeColor(grade.strokeOk[i] ? "ok" : "bad"));
    setResult({ grade, data, colors });
    passed.current[index] = grade.passed; // final answer is sent from the footer, so it can be overridden first
  };

  const finish = () => {
    const ok = passed.current.filter(Boolean).length;
    onAnswer({ correct: ok === chars.length, note: chars.length > 1 ? `${ok}/${chars.length} caracteres bien escritos.` : undefined });
  };

  const accept = () => {
    passed.current[index] = true;
    setResult((r) => r && { ...r, grade: { ...r.grade, passed: true } });
  };

  const next = () => {
    setIndex((i) => i + 1);
    setResult(null);
    setStrokeCount(0);
  };

  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <WordHeader ex={ex} />
      <CharDots total={chars.length} index={index} />
      <div className="flex flex-wrap items-start justify-center gap-4">
        <div className="relative">
          <DrawingCanvas key={index} ref={canvas} size={size} disabled={!!result} strokeColors={result?.colors} onChange={setStrokeCount} />
          {result && <CharacterSvg data={result.data} className="pointer-events-none absolute inset-0 animate-fade-in text-fg opacity-20" />}
        </div>
        {result && (
          <div className="flex animate-fade-in flex-col items-center gap-2">
            <StrokeOrder char={chars[index]} size={Math.min(160, size / 2)} />
            <p className={cn("max-w-[12rem] text-center text-sm font-semibold", result.grade.passed ? "text-ok" : "text-bad")}>
              {result.grade.strokeOk.filter(Boolean).length}/{result.grade.expected} trazos correctos
              {result.grade.drawn !== result.grade.expected && ` (dibujaste ${result.grade.drawn})`}
            </p>
            {!result.grade.passed && !answered && (
              <Button size="sm" variant="secondary" onClick={accept}>
                Creo que estaba bien
              </Button>
            )}
          </div>
        )}
      </div>
      <Footer hidden={answered}>
        {!result ? (
          <>
            <Button variant="ghost" onClick={onSkip}>
              Ahora no
            </Button>
            <Button variant="secondary" aria-label="Deshacer" onClick={() => canvas.current?.undo()}>
              <Undo2 size={20} />
            </Button>
            <Button variant="secondary" aria-label="Borrar" onClick={() => canvas.current?.clear()}>
              <Eraser size={20} />
            </Button>
            <Button variant="ok" size="lg" className="flex-1" disabled={strokeCount === 0} onClick={() => void check()}>
              Comprobar
            </Button>
          </>
        ) : (
          <Button variant={result.grade.passed ? "ok" : "bad"} size="lg" full onClick={isLast ? finish : next}>
            {isLast ? "Continuar" : "Siguiente carácter"}
          </Button>
        )}
      </Footer>
    </>
  );
}

export function WriteExercise(props: ExerciseProps<Write>) {
  return props.exercise.guided ? <GuidedWrite {...props} /> : <FreeWrite {...props} />;
}
