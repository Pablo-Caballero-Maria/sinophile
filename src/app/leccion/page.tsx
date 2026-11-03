"use client";
import { ChevronRight, GraduationCap, Headphones, Layers, Mic, MessageSquareText, Music, PenLine } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Hanzi, Pinyin, SpeakButton, wordHref } from "@/components/hanzi";
import { ButtonLink, Card, EmptyState, PageHeader, ProgressBar, SectionTitle, Skeleton, Stars } from "@/components/ui";
import { LESSON_BY_ID } from "@/lib/data/vocab";
import { lessonMastery, lessonStars, wordMastery } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { useHydrated } from "@/lib/store";
import { formatDay } from "@/lib/text";

const MODES = [
  { modo: "escritura", label: "Escritura", icon: PenLine, color: "text-ok" },
  { modo: "tarjetas", label: "Tarjetas", icon: Layers, color: "text-tone-2" },
  { modo: "escucha", label: "Escucha", icon: Headphones, color: "text-sky" },
  { modo: "pronunciacion", label: "Pronunciación", icon: Mic, color: "text-brand" },
  { modo: "tonos", label: "Tonos", icon: Music, color: "text-tone-4" },
  { modo: "frases", label: "Frases", icon: MessageSquareText, color: "text-gold" },
];

function LessonView() {
  const id = useSearchParams().get("id") ?? "";
  const lesson = LESSON_BY_ID.get(id);
  const hydrated = useHydrated();
  const progress = useProgress();

  if (!lesson) return <EmptyState icon="🔍" title="Lección no encontrada"><Link href="/" className="text-sky underline">Volver al inicio</Link></EmptyState>;

  const mastery = lessonMastery(progress, lesson);
  return (
    <div className="animate-fade-in">
      <PageHeader back="/" title={`Lección ${lesson.number}`} subtitle={`${formatDay(lesson.id)} · ${lesson.words.length} palabras`} />
      <Card className="flex flex-col gap-3">
        {hydrated ? (
          <div className="flex items-center gap-3">
            <Stars count={lessonStars(progress, lesson)} />
            <ProgressBar value={mastery} className="flex-1" barClassName="bg-gold" />
            <span className="text-sm font-bold text-muted">{Math.round(mastery * 100)}%</span>
          </div>
        ) : (
          <Skeleton className="h-5" />
        )}
        <ButtonLink href={`/sesion?modo=leccion&l=${lesson.id}`} size="lg" full>
          Practicar lección
        </ButtonLink>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MODES.map(({ modo, label, icon: Icon, color }) => (
            <Link key={modo} href={`/sesion?modo=${modo}&l=${lesson.id}`} className="flex flex-col items-center gap-1 rounded-2xl border border-line py-3 text-xs font-bold hover:bg-surface-2">
              <Icon size={22} className={color} />
              {label}
            </Link>
          ))}
        </div>
        <ButtonLink href={`/sesion?modo=examen&l=${lesson.id}&n=20`} variant="secondary" full>
          <GraduationCap size={20} className="text-gold" /> Examen de la lección
        </ButtonLink>
      </Card>

      <SectionTitle>Palabras</SectionTitle>
      <ul className="flex flex-col gap-2">
        {lesson.words.map((w) => (
          <li key={w.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <SpeakButton text={w.hanzi} size="sm" slow={false} />
            <Link href={wordHref(w.hanzi, w.id)} className="flex min-w-0 flex-1 items-center gap-3">
              <Hanzi text={w.hanzi} pinyin={w.pinyin} className="text-2xl" />
              <span className="min-w-0 flex-1">
                <Pinyin text={w.pinyin} className="block text-sm font-semibold" />
                <span className="block truncate text-sm text-muted">{w.es}</span>
              </span>
              {hydrated && <ProgressBar value={wordMastery(progress, w.id)} className="h-2 w-14" barClassName="bg-gold" />}
              <ChevronRight size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
      <LessonView />
    </Suspense>
  );
}
