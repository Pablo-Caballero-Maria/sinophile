"use client";
/** Pieces shared by all exercise components: prompt rendering, option rendering, footer bar. */
import { useEffect, type ReactNode } from "react";
import type { AnswerResult, Display, Prompt } from "@/lib/exercises/types";
import { useSettings } from "@/lib/settings/store";
import { Hanzi, Pinyin, SentenceView, SpeakButton } from "../Hanzi";
import { Button, cn } from "../UI";

export interface ExerciseProps<T> {
  exercise: T;
  /** True once graded (feedback is showing): reveal answers, disable input. */
  answered: boolean;
  onAnswer: (result: AnswerResult) => void;
  /** Skip without grading (intro cards, "can't listen now"). */
  onSkip: () => void;
  /** An ungraded exercise was finished (free drawing): earns practice XP and moves on. */
  onPractice: () => void;
}

export function Instruction({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 text-xl font-extrabold sm:text-2xl">{children}</h2>;
}

/** Renders the prompt of an exercise. `filled` fills a sentence blank. */
export function PromptView({
  prompt,
  revealed,
  filled,
}: {
  prompt: Prompt;
  revealed: boolean;
  filled?: string;
}) {
  const settings = useSettings();
  switch (prompt.kind) {
    case "word": {
      const show = prompt.showPinyin || revealed;
      return (
        <div className="flex flex-col items-center gap-3 py-4">
          <Hanzi
            text={prompt.word.hanzi}
            pinyin={prompt.word.pinyin}
            colored={show ? undefined : false}
            className="text-7xl sm:text-8xl"
          />
          {show ? (
            <Pinyin text={prompt.word.pinyin} className="text-xl font-semibold" />
          ) : (
            <span className="h-7" />
          )}
          <SpeakButton
            text={prompt.word.hanzi}
            size="sm"
            autoPlay={settings.autoplayAudio && prompt.showPinyin}
          />
        </div>
      );
    }
    case "text":
      return (
        <div className="mx-auto mb-2 w-fit max-w-full rounded-3xl border-2 border-line bg-surface px-6 py-4 text-center text-2xl font-bold">
          {prompt.text}
        </div>
      );
    case "audio": {
      const r = prompt.reveal;
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <SpeakButton text={prompt.speak} size="lg" autoPlay={settings.autoplayAudio} />
          {revealed &&
            ("zh" in r ? (
              <SentenceView sentence={r} audio={false} size="text-xl" />
            ) : (
              <p className="text-center">
                <Hanzi text={r.hanzi} pinyin={r.pinyin} className="text-3xl" />{" "}
                <Pinyin text={r.pinyin} className="ml-2" /> <span className="text-muted">· {r.es}</span>
              </p>
            ))}
        </div>
      );
    }
    case "sentence": {
      const isFill = prompt.blank !== undefined;
      return (
        <div className="rounded-3xl border-2 border-line bg-surface p-4">
          <SentenceView
            sentence={prompt.sentence}
            blank={revealed ? undefined : prompt.blank}
            filled={filled}
            showPinyin={settings.showPinyin && (!isFill || revealed)}
            showTranslation={prompt.showTranslation || revealed}
            audio={!isFill || revealed}
          />
        </div>
      );
    }
  }
}

/** One option / tile content. `revealPinyin` shows pinyin under hanzi (after answering). */
export function DisplayView({
  display,
  revealPinyin,
  large,
}: {
  display: Display;
  revealPinyin?: boolean;
  large?: boolean;
}) {
  if (display.kind === "hanzi")
    return (
      <span className="flex flex-col items-center">
        <Hanzi
          text={display.text}
          pinyin={display.pinyin}
          colored={revealPinyin ? undefined : false}
          className={large ? "text-4xl" : "text-2xl"}
        />
        {revealPinyin && display.pinyin && <Pinyin text={display.pinyin} className="text-sm" />}
      </span>
    );
  if (display.kind === "pinyin")
    return <Pinyin text={display.text} colored={false} className="text-xl font-semibold" />;
  return <span className="text-lg font-semibold">{display.text}</span>;
}

/** Bottom action bar of an exercise (hidden while the feedback bar is showing). */
export function Footer({ children, hidden }: { children: ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95">
      <div className="mx-auto flex max-w-2xl gap-3 px-4 pt-3">{children}</div>
    </div>
  );
}

/** Footer with the "Comprobar" button; Enter also checks. */
export function CheckFooter({
  disabled,
  onCheck,
  answered,
  label = "Comprobar",
  secondary,
}: {
  disabled: boolean;
  onCheck: () => void;
  answered: boolean;
  label?: string;
  secondary?: ReactNode;
}) {
  useEffect(() => {
    if (answered || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        onCheck();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, disabled, onCheck]);
  return (
    <Footer hidden={answered}>
      {secondary}
      <Button variant="ok" size="lg" className="flex-1" disabled={disabled} onClick={onCheck}>
        {label}
      </Button>
    </Footer>
  );
}

/** Style of an answer button according to its state. */
export function optionClass(state: "idle" | "selected" | "correct" | "wrong" | "dim") {
  return cn(
    "rounded-2xl border-2 border-b-4 bg-surface px-4 py-3 transition-colors active:translate-y-[2px] disabled:active:translate-y-0",
    state === "idle" && "border-line hover:bg-surface-2",
    state === "selected" && "border-sky bg-sky-soft text-sky",
    state === "correct" && "border-ok bg-ok-soft text-ok",
    state === "wrong" && "animate-shake border-bad bg-bad-soft text-bad",
    state === "dim" && "border-line opacity-50",
  );
}
