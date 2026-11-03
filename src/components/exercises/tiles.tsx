"use client";
/** Build a sentence from word tiles (translations both ways and dictations). */
import { useCallback, useState } from "react";
import { vocabByHanzi } from "@/lib/data/vocab";
import { checkTiles } from "@/lib/exercises/check";
import type { Exercise } from "@/lib/exercises/types";
import { useSettings } from "@/lib/settings";
import { speak } from "@/lib/speech";
import { Hanzi, Pinyin } from "../hanzi";
import { cn } from "../ui";
import { CheckFooter, Instruction, PromptView, type ExerciseProps } from "./common";

type Tiles = Extract<Exercise, { type: "tiles" }>;

function TileLabel({ text, zh, showPinyin }: { text: string; zh: boolean; showPinyin: boolean }) {
  if (!zh) return <span className="text-lg font-semibold">{text}</span>;
  const pinyin = vocabByHanzi(text)[0]?.pinyin;
  return (
    <span className="flex flex-col items-center leading-tight">
      <Hanzi text={text} className="text-2xl" />
      {showPinyin && pinyin && <Pinyin text={pinyin} colored={false} className="text-xs text-muted" />}
    </span>
  );
}

const tileClass = "rounded-2xl border-2 border-b-4 border-line bg-surface px-3 py-2 active:translate-y-[2px]";

export function TilesExercise({ exercise: ex, answered, onAnswer }: ExerciseProps<Tiles>) {
  const { showPinyin } = useSettings();
  const [chosen, setChosen] = useState<number[]>([]);
  const zh = ex.lang === "zh";
  const check = useCallback(() => onAnswer(checkTiles(ex, chosen.map((i) => ex.tiles[i]))), [chosen, ex, onAnswer]);

  const add = (i: number) => {
    if (answered) return;
    if (zh) void speak(ex.tiles[i]);
    setChosen((c) => [...c, i]);
  };

  return (
    <>
      <Instruction>{ex.instruction}</Instruction>
      <PromptView prompt={ex.prompt} revealed={answered} />
      {/* answer line */}
      <div className="mt-6 flex min-h-[8rem] flex-wrap content-start gap-2 border-b-2 border-line pb-3" style={{ backgroundImage: "repeating-linear-gradient(transparent 0 3.9rem, var(--line) 3.9rem 4rem)" }}>
        {chosen.map((i, k) => (
          <button key={`${i}-${k}`} type="button" disabled={answered} onClick={() => setChosen((c) => c.filter((x) => x !== i))} className={cn(tileClass, "animate-pop")}>
            <TileLabel text={ex.tiles[i]} zh={zh} showPinyin={showPinyin} />
          </button>
        ))}
      </div>
      {/* bank */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {ex.tiles.map((t, i) =>
          chosen.includes(i) ? (
            <span key={i} className={cn(tileClass, "border-transparent bg-surface-2 text-transparent")} aria-hidden>
              <TileLabel text={t} zh={zh} showPinyin={showPinyin} />
            </span>
          ) : (
            <button key={i} type="button" disabled={answered} onClick={() => add(i)} className={tileClass}>
              <TileLabel text={t} zh={zh} showPinyin={showPinyin} />
            </button>
          ),
        )}
      </div>
      <CheckFooter answered={answered} disabled={chosen.length === 0} onCheck={check} />
    </>
  );
}
