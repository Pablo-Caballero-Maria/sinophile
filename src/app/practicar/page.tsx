"use client";
import {
  GraduationCap,
  Headphones,
  Infinity as InfinityIcon,
  Layers,
  MessageSquareText,
  Mic,
  Music,
  PenLine,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SilentModeCheckbox } from "@/components/SilentMode";
import { Badge, ButtonLink, Card, cn, PageHeader, SectionTitle, Segmented, Toggle } from "@/components/UI";
import { LESSONS, VOCAB_IDS } from "@/lib/data/vocab";
import { isNoisyMode, reviewable } from "@/lib/exercises/silent";
import type { CardFront, SessionMode } from "@/lib/exercises/types";
import { dueItems } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { useSettings } from "@/lib/settings/store";
import { useReady } from "@/lib/account/client";

interface Mode {
  modo: SessionMode;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

/** What each flashcard option shows first (and what the back then reveals). */
const CARD_FRONT_HELP: Record<CardFront | "mezcla", string> = {
  es: "Ves la palabra en español; detrás, el hanzi, el pinyin y su pronunciación.",
  hanzi: "Ves el hanzi; detrás, el pinyin, el significado y su pronunciación.",
  pinyin: "Ves el pinyin; detrás, el hanzi, el significado y su pronunciación.",
  audio: "Oyes la palabra; detrás, el hanzi, el pinyin y el significado.",
  mezcla: "Cada tarjeta empieza por una cara distinta (sin audio en modo silencioso).",
};

const MODES: Mode[] = [
  {
    modo: "infinito",
    title: "Modo infinito",
    description: "Ejercicios sin fin hasta perder 3 vidas.",
    icon: InfinityIcon,
    color: "bg-brand",
  },
  {
    modo: "escucha",
    title: "Escucha",
    description: "Reconoce palabras y frases de oído.",
    icon: Headphones,
    color: "bg-sky",
  },
  {
    modo: "pronunciacion",
    title: "Pronunciación",
    description: "Habla y comprueba si se te entiende.",
    icon: Mic,
    color: "bg-brand",
  },
  {
    modo: "tonos",
    title: "Pinyin y tonos",
    description: "Distingue y escribe los tonos.",
    icon: Music,
    color: "bg-accent-blue",
  },
  {
    modo: "frases",
    title: "Frases",
    description: "Huecos, traducciones y diálogos.",
    icon: MessageSquareText,
    color: "bg-gold",
  },
];

function ModeCard({ mode, href, badge }: { mode: Mode; href: string; badge?: string }) {
  const Icon = mode.icon;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
    >
      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white", mode.color)}>
        <Icon size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-extrabold">
          {mode.title} {badge && <Badge>{badge}</Badge>}
        </span>
        <span className="block text-sm text-muted">{mode.description}</span>
      </span>
    </Link>
  );
}

export default function PracticePage() {
  const ready = useReady();
  const progress = useProgress();
  const silentMode = useSettings((s) => s.silentMode);
  const [scope, setScope] = useState<string[]>([]);
  const [writingStyle, setWritingStyle] = useState<"guiado" | "libre" | "mixto">("mixto");
  const [cardFront, setCardFront] = useState<CardFront | "mezcla">("mezcla");
  // The audio face needs sound: in silent mode it's the mix (which then leaves audio out).
  const front = silentMode && cardFront === "audio" ? "mezcla" : cardFront;
  const [examSize, setExamSize] = useState(20);
  const [examWriting, setExamWriting] = useState(false);

  const l = scope.length ? `&l=${scope.join(",")}` : "";
  const due = ready ? reviewable(dueItems(progress, VOCAB_IDS), silentMode).length : 0;
  const toggle = (id: string) => setScope((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const lastExam = progress.exams.at(-1);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Practicar" subtitle="Elige qué lecciones y cómo quieres practicar." />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <button
          type="button"
          onClick={() => setScope([])}
          className={cn(
            "shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold",
            scope.length === 0 ? "border-sky bg-sky-soft text-sky" : "border-line",
          )}
        >
          Todas
        </button>
        {LESSONS.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            onClick={() => toggle(lesson.id)}
            className={cn(
              "shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold",
              scope.includes(lesson.id) ? "border-sky bg-sky-soft text-sky" : "border-line",
            )}
          >
            Lección {lesson.number}
          </button>
        ))}
      </div>

      <SilentModeCheckbox className="mt-3" />

      <Card tone="sky" className="mt-4 flex items-center gap-4">
        <RotateCcw size={36} className="shrink-0 text-sky" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Repaso inteligente</p>
          <p className="text-sm text-muted">
            {due
              ? `${due} ejercicios pendientes según tu curva de olvido.`
              : "Nada pendiente: repasa tus palabras más débiles."}
          </p>
        </div>
        <ButtonLink href={`/sesion?modo=repaso${l}`} variant="sky">
          Repasar
        </ButtonLink>
      </Card>

      <SectionTitle>Modos de práctica</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.filter((mode) => !silentMode || !isNoisyMode(mode.modo)).map((mode) => (
          <ModeCard
            key={mode.modo}
            mode={mode}
            href={`/sesion?modo=${mode.modo}${l}`}
            badge={
              mode.modo === "infinito" && ready && progress.records.infinite
                ? `Récord ${progress.records.infinite}`
                : undefined
            }
          />
        ))}
      </div>

      <SectionTitle>Tarjetas</SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-orange text-white">
            <Layers size={24} />
          </span>
          <p className="text-sm text-muted">
            Flashcards rápidas: ves una cara de la palabra, la recuerdas y das la vuelta a la tarjeta para ver
            el resto. Tú decides si te la sabías.
          </p>
        </div>
        <Segmented
          value={front}
          onChange={setCardFront}
          options={[
            { value: "es", label: "Español" },
            { value: "hanzi", label: "Hanzi" },
            { value: "pinyin", label: "Pinyin" },
            ...(silentMode ? [] : [{ value: "audio" as const, label: "Audio" }]),
            { value: "mezcla", label: "Mezcla" },
          ]}
        />
        <p className="text-sm text-muted">{CARD_FRONT_HELP[front]}</p>
        <ButtonLink
          href={`/sesion?modo=tarjetas${front === "mezcla" ? "" : `&cara=${front}`}${l}`}
          variant="gold"
          full
        >
          Repasar con tarjetas
        </ButtonLink>
      </Card>

      <SectionTitle>Escritura de hanzi</SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ok text-white">
            <PenLine size={24} />
          </span>
          <p className="text-sm text-muted">
            <b className="text-fg">Guiada</b>: trazas sobre la plantilla y se corrige el orden de trazos.{" "}
            <b className="text-fg">Libre</b>: ves la palabra en español, la dibujas de memoria y se te revela
            el hanzi, sin corrección.
          </p>
        </div>
        <Segmented
          value={writingStyle}
          onChange={setWritingStyle}
          options={[
            { value: "guiado", label: "Guiada" },
            { value: "libre", label: "Libre" },
            { value: "mixto", label: "Ambas" },
          ]}
        />
        <ButtonLink href={`/sesion?modo=escritura&estilo=${writingStyle}${l}`} variant="ok" full>
          Escribir
        </ButtonLink>
      </Card>

      <SectionTitle>
        <span id="examen" className="scroll-mt-20">
          Examen
        </span>
      </SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold text-white">
            <GraduationCap size={24} />
          </span>
          <p className="text-sm text-muted">
            Preguntas variadas sin pistas ni correcciones hasta el final. Nota del 0 al 10.
          </p>
        </div>
        <Segmented
          value={examSize}
          onChange={setExamSize}
          options={[10, 20, 30].map((n) => ({ value: n, label: `${n} preguntas` }))}
        />
        <Toggle checked={examWriting} onChange={setExamWriting} label="Incluir escritura de memoria" />
        <ButtonLink
          href={`/sesion?modo=examen&n=${examSize}${examWriting ? "&escritura=1" : ""}${l}`}
          variant="gold"
          full
        >
          Empezar examen
        </ButtonLink>
        {ready && lastExam && (
          <p className="text-center text-sm text-muted">
            Último examen: <b className="text-fg">{lastExam.grade.toLocaleString("es-ES")}</b> (
            {lastExam.correct}/{lastExam.total}) ·{" "}
            <Link href="/progreso#examenes" className="underline">
              ver historial
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}
