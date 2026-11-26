"use client";
/**
 * Word introduction card and self-graded flashcards. A flashcard starts on one face of the word
 * (the Spanish, the hanzi, the pinyin or its sound) and its back shows the rest.
 */
import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Exercise } from "@/lib/exercises/types";
import { useSettings } from "@/lib/settings/store";
import { speak } from "@/lib/speech";
import { hanChars } from "@/lib/text";
import { Hanzi, Pinyin, SentenceView, SpeakButton, StrokeOrder } from "../Hanzi";
import { Badge, Button } from "../UI";
import { Footer, Instruction, type ExerciseProps } from "./Common";

type Intro = Extract<Exercise, { type: "intro" }>;
type Flashcard = Extract<Exercise, { type: "flashcard" }>;

export function IntroCard({ exercise: ex, onSkip }: ExerciseProps<Intro>) {
  const autoplayAudio = useSettings((s) => s.autoplayAudio);
  const { word } = ex;
  return (
    <>
      <Badge className="mb-3 bg-brand-soft text-brand">✨ Palabra nueva</Badge>
      <div className="flex flex-col items-center gap-2 text-center">
        <Hanzi text={word.hanzi} pinyin={word.pinyin} className="text-8xl" />
        <Pinyin text={word.pinyin} className="text-2xl font-semibold" />
        <p className="text-2xl font-bold">{word.es}</p>
        <SpeakButton text={word.hanzi} autoPlay={autoplayAudio} className="mt-1" />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hanChars(word.hanzi).map((c, i) => (
          <StrokeOrder key={`${c}-${i}`} char={c} size={96} />
        ))}
      </div>
      {ex.note && <p className="mt-6 rounded-2xl bg-gold-soft p-4 text-sm">💡 {ex.note}</p>}
      {ex.example && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <SentenceView sentence={ex.example} highlight={word.hanzi} size="text-xl" />
        </div>
      )}
      <Footer>
        <Button variant="primary" size="lg" full onClick={onSkip}>
          ¡Entendido!
        </Button>
      </Footer>
    </>
  );
}

/** The front of a flashcard: one face of the word (lib/exercises/types.ts, CardFront). */
function CardFace({ card }: { card: Flashcard }) {
  const { word } = card;
  switch (card.front) {
    case "es":
      return <span className="text-3xl font-bold">{word.es}</span>;
    case "hanzi":
      return <Hanzi text={word.hanzi} className="text-8xl" colored={false} />;
    case "pinyin":
      return <Pinyin text={word.pinyin} className="text-4xl font-semibold" />;
    case "audio":
      return (
        <span className="flex flex-col items-center gap-3 text-sky">
          <Volume2 size={72} aria-hidden />
          <span className="text-lg font-bold text-fg">Escucha la palabra</span>
        </span>
      );
  }
}

export function FlashcardExercise({ exercise: ex, answered, onAnswer }: ExerciseProps<Flashcard>) {
  const [flipped, setFlipped] = useState(false);
  const { word } = ex;
  const listening = ex.front === "audio";
  // The audio face plays the word as it appears (it's the question); the others say it on flipping.
  useEffect(() => {
    if (!listening) return;
    const timer = setTimeout(() => void speak(word.hanzi), 250);
    return () => clearTimeout(timer);
  }, [listening, word.hanzi]);
  const flip = () => {
    setFlipped(true);
    if (!listening) void speak(word.hanzi);
  };
  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <button
        type="button"
        onClick={flip}
        disabled={flipped}
        aria-label={flipped ? undefined : "Dar la vuelta a la tarjeta"}
        className="flex min-h-80 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-b-[6px] border-line bg-surface p-6 text-center"
      >
        {!flipped ? (
          <CardFace card={ex} />
        ) : (
          // The back: the hanzi, its pinyin and (unless the question was the Spanish) what it means.
          <span className="flex animate-pop flex-col items-center gap-2">
            <Hanzi text={word.hanzi} pinyin={word.pinyin} className="text-7xl" />
            <Pinyin text={word.pinyin} className="text-2xl font-semibold" />
            {ex.front !== "es" && <span className="text-xl font-bold">{word.es}</span>}
          </span>
        )}
        {!flipped && (
          <span className="mt-4 text-sm font-semibold text-muted">Toca para ver la respuesta</span>
        )}
      </button>
      {(flipped || listening) && (
        <div className="mt-3 flex justify-center">
          <SpeakButton text={word.hanzi} size={listening && !flipped ? "lg" : "sm"} />
        </div>
      )}
      <Footer hidden={answered}>
        {!flipped ? (
          <Button variant="sky" size="lg" full onClick={flip}>
            Mostrar respuesta
          </Button>
        ) : (
          <>
            <Button variant="bad" size="lg" className="flex-1" onClick={() => onAnswer({ correct: false })}>
              No me la sabía
            </Button>
            <Button variant="ok" size="lg" className="flex-1" onClick={() => onAnswer({ correct: true })}>
              Me la sabía
            </Button>
          </>
        )}
      </Footer>
    </>
  );
}
