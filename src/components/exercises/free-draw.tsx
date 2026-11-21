"use client";
/**
 * Free drawing from memory, with no evaluation: the Spanish word is shown, the
 * learner draws its characters one by one and then the real hanzi is revealed to
 * compare by eye. They can repeat the word as often as they like or move on.
 */
import { Eraser, RotateCcw, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import type { Point } from "@/lib/drawing";
import type { VocabEntry } from "@/lib/types";
import { hanChars } from "@/lib/text";
import { DrawingCanvas, DrawingPreview, type DrawingCanvasHandle } from "../drawing-canvas";
import { Hanzi, Pinyin, SpeakButton, StrokeOrder } from "../hanzi";
import { Button } from "../ui";
import { Footer, Instruction, PromptView, type ExerciseProps } from "./common";
import { boxSize, CharDots, type Write } from "./write-shared";

const MAX_PREVIEW = 160;

/** The word with each drawing next to the real character. */
function Reveal({
  word,
  chars,
  drawings,
  canvasSize,
}: {
  word: VocabEntry;
  chars: string[];
  drawings: Point[][][];
  canvasSize: number;
}) {
  const preview = Math.min(MAX_PREVIEW, Math.floor(canvasSize / 2));
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col items-center gap-1 text-center">
        <Hanzi text={word.hanzi} pinyin={word.pinyin} className="text-6xl" />
        <Pinyin text={word.pinyin} className="text-xl font-semibold" />
        <span className="text-muted">{word.es}</span>
        <SpeakButton text={word.hanzi} size="sm" slow={false} className="mt-1" />
      </div>
      <div
        className="mt-5 grid justify-center gap-3"
        style={{ gridTemplateColumns: `repeat(2, ${preview}px)` }}
      >
        <p className="text-center text-sm font-semibold text-muted">Tu dibujo</p>
        <p className="text-center text-sm font-semibold text-muted">Así se escribe</p>
        {chars.flatMap((char, i) => [
          <DrawingPreview
            key={`drawing-${i}`}
            strokes={drawings[i]}
            canvasSize={canvasSize}
            size={preview}
          />,
          <StrokeOrder key={`char-${i}`} char={char} size={preview} />,
        ])}
      </div>
    </div>
  );
}

/** One go at the word, from the blank canvas to the reveal. */
function Attempt({
  exercise: ex,
  onRepeat,
  onNext,
  onSkip,
}: {
  exercise: Write;
  onRepeat: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const chars = hanChars(ex.word.hanzi);
  const [drawings, setDrawings] = useState<Point[][][]>([]);
  const canvas = useRef<DrawingCanvasHandle>(null);
  const [size] = useState(boxSize);
  const index = drawings.length;

  const finishCharacter = () => {
    const strokes = canvas.current?.strokes() ?? [];
    setDrawings((done) => [...done, strokes]);
  };

  if (index === chars.length) {
    return (
      <>
        <Reveal word={ex.word} chars={chars} drawings={drawings} canvasSize={size} />
        <Footer>
          <Button variant="secondary" size="lg" className="flex-1" onClick={onRepeat}>
            <RotateCcw size={20} /> Repetir
          </Button>
          <Button size="lg" className="flex-1" onClick={onNext}>
            Siguiente
          </Button>
        </Footer>
      </>
    );
  }

  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <PromptView prompt={{ kind: "text", text: ex.word.es }} revealed={false} />
      <div className="mt-4">
        <CharDots total={chars.length} index={index} />
      </div>
      <div className="flex justify-center">
        <DrawingCanvas key={index} ref={canvas} size={size} />
      </div>
      <Footer>
        <Button variant="ghost" onClick={onSkip}>
          Ahora no
        </Button>
        <Button variant="secondary" aria-label="Deshacer" onClick={() => canvas.current?.undo()}>
          <Undo2 size={20} />
        </Button>
        <Button variant="secondary" aria-label="Borrar" onClick={() => canvas.current?.clear()}>
          <Eraser size={20} />
        </Button>
        {/* Never disabled: not remembering the word at all is a reason to see it. */}
        <Button variant="sky" size="lg" className="flex-1" onClick={finishCharacter}>
          {index < chars.length - 1 ? "Siguiente carácter" : "Ver hanzi"}
        </Button>
      </Footer>
    </>
  );
}

export function FreeDraw({ exercise, onPractice, onSkip }: ExerciseProps<Write>) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Attempt
      key={attempt}
      exercise={exercise}
      onRepeat={() => setAttempt((a) => a + 1)}
      onNext={onPractice}
      onSkip={onSkip}
    />
  );
}
