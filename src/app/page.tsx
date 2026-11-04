"use client";
import { CalendarCheck, Flame, GraduationCap, Infinity as InfinityIcon, Layers, PenLine, RotateCcw, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { LESSONS, VOCAB, VOCAB_IDS, VOCAB_ISSUES } from "@/lib/data/vocab";
import { dueItems, isSeen, lessonMastery, lessonStars, streakInfo, type Progress } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { useSettings } from "@/lib/settings/store";
import { useAccount, useReady, type AccountState } from "@/lib/account/client";
import { dayKey } from "@/lib/text";
import type { Lesson } from "@/lib/types";
import { ButtonLink, Card, cn, EmptyState, Ring, SectionTitle, Skeleton, Stars } from "@/components/ui";

function recommendation(p: Progress, due: number): { label: string; href: string } | null {
  if (LESSONS.length === 0) return null;
  const fresh = LESSONS.find((l) => l.words.some((w) => !isSeen(p, w.id)));
  if (due >= 5 || (!fresh && due > 0)) return { label: `Repasar ${due} pendientes`, href: "/sesion?modo=repaso" };
  if (fresh) return { label: `Continuar lección ${fresh.number}`, href: `/sesion?modo=leccion&l=${fresh.id}` };
  const weakest = [...LESSONS].sort((a, b) => lessonMastery(p, a) - lessonMastery(p, b))[0];
  return { label: `Practicar lección ${weakest.number}`, href: `/sesion?modo=leccion&l=${weakest.id}` };
}

function DailyCard({ progress }: { progress: Progress }) {
  const { dailyGoal } = useSettings();
  const today = progress.days[dayKey()]?.xp ?? 0;
  const streak = streakInfo(progress);
  const due = dueItems(progress, VOCAB_IDS).length;
  const next = recommendation(progress, due);
  const done = today >= dailyGoal;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Ring value={today / dailyGoal} size={76} color={done ? "var(--ok)" : "var(--gold)"}>
          <span className="text-center text-xs font-bold leading-tight">
            <span className="block text-lg">{today}</span>/{dailyGoal}
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold">{done ? "¡Meta diaria cumplida! 🎉" : today ? "¡Sigue así!" : "¡你好! ¿Practicamos?"}</p>
          <p className="text-sm text-muted">
            {done ? "Puedes seguir sumando XP." : `Te faltan ${dailyGoal - today} XP para tu meta diaria.`}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
            <Flame size={16} className={streak.practicedToday ? "fill-gold text-gold" : "text-muted"} />
            {streak.current} {streak.current === 1 ? "día" : "días"} de racha
            {!streak.practicedToday && streak.current > 0 && <span className="font-normal text-muted"> · ¡practica hoy para no perderla!</span>}
          </p>
        </div>
      </div>
      {next && (
        <ButtonLink href={next.href} size="lg" full>
          {next.label}
        </ButtonLink>
      )}
    </Card>
  );
}

const ZIGZAG = [0, 44, 66, 44, 0, -44, -66, -44];

function LessonNode({ lesson, progress, index, current }: { lesson: Lesson; progress: Progress; index: number; current: boolean }) {
  const stars = lessonStars(progress, lesson);
  const started = lesson.words.some((w) => isSeen(progress, w.id));
  return (
    <div className="flex flex-col items-center" style={{ transform: `translateX(${ZIGZAG[index % ZIGZAG.length]}px)` }}>
      <Link href={`/leccion?id=${lesson.id}`} className="group relative" aria-label={`Lección ${lesson.number}`}>
        {current && <span className="absolute -inset-2 animate-ping rounded-full bg-brand/20" />}
        <span
          className={cn(
            "relative grid h-20 w-20 place-items-center rounded-full border-b-[6px] text-3xl font-black text-white transition-transform group-active:translate-y-1",
            stars >= 1 ? "border-gold-strong bg-gold" : started || current ? "border-brand-strong bg-brand" : "border-line bg-surface-2 text-muted",
          )}
        >
          {stars === 3 ? "★" : lesson.number}
        </span>
      </Link>
      <Stars count={stars} className="mt-2" />
      <span className="mt-0.5 text-sm font-bold">Lección {lesson.number}</span>
      <span className="text-xs text-muted">{lesson.words.length} palabras</span>
    </div>
  );
}

/** Reminds guests (and offline starts) that nothing is saved. */
function GuestNotice({ account }: { account: AccountState }) {
  if (account.status === "user" || account.status === "loading") return null;
  const [Icon, title, text] =
    account.status === "offline"
      ? [TriangleAlert, "Sin conexión con el servidor", "Puedes practicar, pero tu progreso no se guardará."]
      : [UserRound, "Estás en modo invitado", "Puedes practicar todo, pero tu progreso no se guardará. Entra o crea una cuenta para conservarlo."];
  return (
    <Link href="/cuenta" className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-sky/40 bg-sky-soft p-3 text-sm">
      <Icon size={24} className="shrink-0 text-sky" />
      <span>
        <b className="block">{title}</b>
        <span className="text-muted">{text}</span>
      </span>
    </Link>
  );
}

const QUICK = [
  { href: "/sesion?modo=repaso", label: "Repaso", icon: RotateCcw, color: "text-sky" },
  { href: "/sesion?modo=infinito", label: "Infinito", icon: InfinityIcon, color: "text-brand" },
  { href: "/practicar#examen", label: "Examen", icon: GraduationCap, color: "text-gold" },
  { href: "/sesion?modo=escritura", label: "Escritura", icon: PenLine, color: "text-ok" },
  { href: "/sesion?modo=tarjetas", label: "Tarjetas", icon: Layers, color: "text-tone-2" },
];

export default function HomePage() {
  const ready = useReady();
  const account = useAccount();
  const progress = useProgress();

  if (LESSONS.length === 0) {
    return (
      <EmptyState icon="📒" title="Aún no hay vocabulario">
        Crea en GitHub una carpeta por clase, <code>data/lección 1/</code>, <code>data/lección 2/</code>…, con su <code>vocab.json</code>, y la app se actualizará sola.
      </EmptyState>
    );
  }

  const current = LESSONS.find((l) => l.words.some((w) => !isSeen(progress, w.id)));
  const due = ready ? dueItems(progress, VOCAB_IDS).length : 0;

  return (
    <div className="animate-fade-in">
      {VOCAB_ISSUES.length > 0 && (
        <Link href="/ajustes#datos" className="mb-4 flex items-center gap-2 rounded-2xl bg-gold-soft p-3 text-sm font-semibold text-gold-strong">
          <TriangleAlert size={18} /> El vocabulario tiene {VOCAB_ISSUES.length} problema(s). Toca para verlos.
        </Link>
      )}

      <GuestNotice account={account} />

      {ready ? <DailyCard progress={progress} /> : <Skeleton className="h-48 rounded-3xl" />}

      <div className="mt-4 grid grid-cols-5 gap-2">
        {QUICK.map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href} className="relative flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-3 text-xs font-bold hover:bg-surface-2">
            <Icon size={24} className={color} />
            {label}
            {label === "Repaso" && due > 0 && (
              <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-brand px-1.5 text-center text-xs leading-6 text-white">{due}</span>
            )}
          </Link>
        ))}
      </div>

      <SectionTitle action={<span className="flex items-center gap-1 text-sm text-muted"><CalendarCheck size={16} />{VOCAB.length} palabras</span>}>
        Tus lecciones
      </SectionTitle>
      <div className="flex flex-col items-center gap-8 py-4">
        {ready
          ? LESSONS.map((lesson, i) => <LessonNode key={lesson.id} lesson={lesson} progress={progress} index={i} current={lesson === current} />)
          : LESSONS.map((l) => <Skeleton key={l.id} className="h-28 w-28 rounded-full" />)}
      </div>
    </div>
  );
}
