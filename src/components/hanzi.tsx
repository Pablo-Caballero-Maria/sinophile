"use client";
/** Components for showing Chinese: tone-coloured hanzi & pinyin, audio, stroke order, sentences. */
import { Turtle, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { vocabByHanzi } from "@/lib/data/vocab";
import { charTones, segmentPinyin, type Tone } from "@/lib/pinyin";
import { useSettings } from "@/lib/settings/store";
import { speak } from "@/lib/speech";
import { hanziWriterLoader, loadStrokes, STROKE_TRANSFORM, type StrokeData } from "@/lib/strokes";
import { hasHan, isPunctuation } from "@/lib/text";
import type { Sentence } from "@/lib/types";
import { cn, Skeleton } from "./ui";

const TONE_CLASS: Record<Tone, string> = { 1: "text-tone-1", 2: "text-tone-2", 3: "text-tone-3", 4: "text-tone-4", 5: "text-tone-5" };

/** Hanzi text, coloured per character by tone when pinyin is given and the setting is on. */
export function Hanzi({ text, pinyin, colored, className }: { text: string; pinyin?: string; colored?: boolean; className?: string }) {
  const settings = useSettings();
  const tones = pinyin && (colored ?? settings.toneColors) ? charTones(text, pinyin) : null;
  let i = 0;
  return (
    <span lang="zh-CN" className={cn("font-hanzi", className)}>
      {tones
        ? [...text].map((ch, k) => (
            <span key={k} className={hasHan(ch) ? TONE_CLASS[tones[i++]] : undefined}>
              {ch}
            </span>
          ))
        : text}
    </span>
  );
}

/** Pinyin with each syllable coloured by tone. */
export function Pinyin({ text, colored, className }: { text: string; colored?: boolean; className?: string }) {
  const settings = useSettings();
  if (!(colored ?? settings.toneColors)) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {segmentPinyin(text).map((s, k) => (
        <span key={k} className={s.tone ? TONE_CLASS[s.tone] : undefined}>
          {s.text}
        </span>
      ))}
    </span>
  );
}

/** Speaker button (+ optional slow "turtle" button). Hidden in silent mode. */
export function SpeakButton({ text, slow = true, size = "md", autoPlay = false, className }: { text: string; slow?: boolean; size?: "sm" | "md" | "lg"; autoPlay?: boolean; className?: string }) {
  const { silentMode } = useSettings();
  const [playing, setPlaying] = useState(false);
  const play = (isSlow = false) => {
    setPlaying(true);
    void speak(text, { slow: isSlow }).finally(() => setPlaying(false));
  };
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setTimeout(() => void speak(text), 250);
    return () => clearTimeout(timer);
  }, [autoPlay, text]);
  if (silentMode) return null;
  const dims = { sm: "h-9 w-9", md: "h-12 w-12", lg: "h-20 w-20" }[size];
  const icon = { sm: 18, md: 22, lg: 36 }[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => play()}
        aria-label="Escuchar"
        className={cn("grid place-items-center rounded-2xl border-b-4 border-sky-strong bg-sky text-white active:translate-y-[2px] active:border-b-2", dims, playing && "animate-pulse")}
      >
        <Volume2 size={icon} />
      </button>
      {slow && (
        <button
          type="button"
          onClick={() => play(true)}
          aria-label="Escuchar despacio"
          className={cn("grid place-items-center rounded-2xl border-2 border-b-4 border-line bg-surface text-sky active:translate-y-[2px]", size === "lg" ? "h-14 w-14" : "h-9 w-9")}
        >
          <Turtle size={size === "lg" ? 26 : 18} />
        </button>
      )}
    </span>
  );
}

/** 米字格: the classic practice grid behind characters. */
export function RiceGrid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="var(--line)" strokeWidth="1" rx="2" />
      <g stroke="var(--line)" strokeWidth="0.6" strokeDasharray="2 2">
        <line x1="50" y1="0" x2="50" y2="100" />
        <line x1="0" y1="50" x2="100" y2="50" />
        <line x1="0" y1="0" x2="100" y2="100" />
        <line x1="100" y1="0" x2="0" y2="100" />
      </g>
    </svg>
  );
}

/** Static SVG of a character from stroke data, optionally colouring strokes. */
export function CharacterSvg({ data, colors, className }: { data: StrokeData; colors?: string[]; className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} aria-hidden>
      <g transform={STROKE_TRANSFORM}>
        {data.strokes.map((d, i) => (
          <path key={i} d={d} fill={colors?.[i] ?? "currentColor"} />
        ))}
      </g>
    </svg>
  );
}

export function useStrokeData(char: string) {
  const [state, setState] = useState<{ char: string; data: StrokeData | null; error: boolean }>({ char, data: null, error: false });
  useEffect(() => {
    let alive = true;
    loadStrokes(char).then(
      (data) => alive && setState({ char, data, error: false }),
      () => alive && setState({ char, data: null, error: true }),
    );
    return () => {
      alive = false;
    };
  }, [char]);
  return state.char === char ? state : { char, data: null, error: false };
}

/** Theme colours resolved for libraries that need concrete values (Hanzi Writer). */
export function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || "#888";
}

type HanziWriterType = typeof import("hanzi-writer").default;
type Writer = ReturnType<HanziWriterType["create"]>;

/** Lazily loads Hanzi Writer and creates an instance in `el`. */
async function createWriter(el: HTMLElement, char: string, size: number, options: Record<string, unknown>): Promise<Writer> {
  const HanziWriter = (await import("hanzi-writer")).default;
  el.innerHTML = "";
  return HanziWriter.create(el, char, {
    width: size,
    height: size,
    padding: Math.round(size * 0.06),
    strokeColor: themeColor("fg"),
    outlineColor: themeColor("line"),
    radicalColor: themeColor("brand"),
    highlightColor: themeColor("sky"),
    drawingColor: themeColor("fg"),
    drawingWidth: Math.max(14, size / 14),
    charDataLoader: hanziWriterLoader,
    ...options,
  });
}

/** Looping stroke-order animation of one character. */
export function StrokeOrder({ char, size = 140, className }: { char: string; size?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let writer: Writer | null = null;
    let alive = true;
    createWriter(el, char, size, {
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 250,
      delayBetweenLoops: 1500,
      onLoadCharDataSuccess: () => alive && setReady(true),
      onLoadCharDataError: () => alive && setFailed(true),
    })
      .then((w) => {
        writer = w;
        if (alive) w.loopCharacterAnimation();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      writer?.pauseAnimation();
      el.innerHTML = "";
    };
  }, [char, size]);
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <RiceGrid />
      {!ready && !failed && <Skeleton className="absolute inset-2" />}
      {failed && (
        <span lang="zh-CN" className="absolute inset-0 grid place-items-center font-hanzi text-muted" style={{ fontSize: size * 0.7 }}>
          {char}
        </span>
      )}
      <div ref={ref} className="relative" />
    </div>
  );
}

/**
 * Hanzi Writer quiz for one character (guided writing with outline).
 * Reports the number of mistakes when done.
 */
export function HanziQuiz({ char, size, outline = true, onComplete, onStroke }: { char: string; size: number; outline?: boolean; onComplete: (mistakes: number, strokes: number) => void; onStroke?: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const writerRef = useRef<Writer | null>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onComplete, onStroke });
  useEffect(() => {
    callbacks.current = { onComplete, onStroke };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    createWriter(el, char, size, {
      showCharacter: false,
      showOutline: outline,
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      leniency: 1.1,
      onLoadCharDataSuccess: () => alive && setReady(true),
    }).then((w) => {
      if (!alive) return;
      writerRef.current = w;
      w.quiz({
        onMistake: () => callbacks.current.onStroke?.(false),
        onCorrectStroke: () => callbacks.current.onStroke?.(true),
        onComplete: (summary: { totalMistakes: number }) => {
          void loadStrokes(char).then((d) => callbacks.current.onComplete(summary.totalMistakes, d.strokes.length));
        },
      });
    });
    return () => {
      alive = false;
      writerRef.current?.cancelQuiz();
      el.innerHTML = "";
    };
  }, [char, size, outline]);

  return (
    <div className="relative touch-none select-none" style={{ width: size, height: size }}>
      <RiceGrid />
      {!ready && <Skeleton className="absolute inset-3" />}
      <div ref={ref} className="relative" />
    </div>
  );
}

/** Tappable token: shows pinyin + meaning of known words in a small popover. */
function Token({ token, highlight }: { token: string; highlight?: boolean }) {
  const [open, setOpen] = useState(false);
  const word = vocabByHanzi(token)[0];
  if (!word) return <span className={highlight ? "text-brand" : undefined}>{token}</span>;
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cn("rounded underline decoration-line decoration-dotted underline-offset-[6px]", highlight && "text-brand")}>
        <Hanzi text={token} pinyin={word.pinyin} colored={false} />
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-20 mt-1 w-max max-w-[12rem] -translate-x-1/2 animate-pop rounded-xl border border-line bg-surface px-3 py-1.5 text-center text-sm font-normal shadow-lg">
          <Pinyin text={word.pinyin} className="block font-semibold" />
          <span className="block text-muted">{word.es}</span>
        </span>
      )}
    </span>
  );
}

/** A Chinese sentence with optional blank, pinyin line, translation and audio. */
export function SentenceView({
  sentence,
  blank,
  filled,
  showPinyin = true,
  showTranslation = true,
  audio = true,
  highlight,
  size = "text-2xl",
  extra,
}: {
  sentence: Sentence;
  blank?: number;
  filled?: string;
  showPinyin?: boolean;
  showTranslation?: boolean;
  audio?: boolean;
  highlight?: string;
  size?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {audio && <SpeakButton text={sentence.zh.join("")} size="sm" slow={false} className="mt-1" />}
      <div className="min-w-0 flex-1">
        <p lang="zh-CN" className={cn("font-hanzi leading-relaxed", size)}>
          {sentence.zh.map((token, i) =>
            i === blank ? (
              <span key={i} className={cn("mx-1 inline-block min-w-[2.5em] border-b-4 text-center", filled ? "border-sky text-sky" : "border-line text-transparent")}>
                {filled ?? "＿"}
              </span>
            ) : isPunctuation(token) ? (
              <span key={i}>{token}</span>
            ) : (
              <Token key={i} token={token} highlight={token === highlight} />
            ),
          )}
        </p>
        {showPinyin && <Pinyin text={sentence.pinyin} className="mt-1 block text-sm text-muted" />}
        {showTranslation && <p className="mt-1 text-muted">{sentence.es}</p>}
        {extra}
      </div>
    </div>
  );
}

/** Links a hanzi to its dictionary page. */
export const wordHref = (hanzi: string, id?: string) => (id ? `/palabra?id=${encodeURIComponent(id)}` : `/palabra?h=${encodeURIComponent(hanzi)}`);

export function WordLink({ hanzi, id, children, className }: { hanzi: string; id?: string; children: ReactNode; className?: string }) {
  return (
    <Link href={wordHref(hanzi, id)} className={className}>
      {children}
    </Link>
  );
}
