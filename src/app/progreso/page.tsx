"use client";
import { BookCheck, Clock, Flame, Lock, Target, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, cn, PageHeader, ProgressBar, SectionTitle, Skeleton, Stars } from "@/components/ui";
import { LESSONS, VOCAB } from "@/lib/data/vocab";
import { ACHIEVEMENTS } from "@/lib/progress/achievements";
import {
  isLearned,
  lessonMastery,
  lessonStars,
  levelInfo,
  skillMastery,
  streakInfo,
  totalXp,
  type Progress,
} from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { useSettings } from "@/lib/settings/store";
import { useReady } from "@/lib/account/client";
import { addDays, dayKey, formatDay } from "@/lib/text";
import { SKILLS } from "@/lib/types";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const weekday = (key: string) => WEEKDAYS[new Date(`${key}T12:00:00`).getDay()];

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

/** Column chart of the last 7 days' XP with the daily-goal reference line. */
function WeekChart({ progress }: { progress: Progress }) {
  const { dailyGoal } = useSettings();
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const values = days.map((d) => progress.days[d]?.xp ?? 0);
  const max = Math.max(dailyGoal * 1.2, ...values, 1);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? 6;
  const H = 140;
  return (
    <Card>
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        <b className="text-fg">
          {weekday(days[shown])} {formatDay(days[shown], false)}
        </b>
        : {values[shown]} XP
        {values[shown] >= dailyGoal ? " · meta cumplida ✓" : ""}
      </p>
      <div className="relative" style={{ height: H }}>
        {/* goal reference line */}
        <div
          className="absolute inset-x-0 border-t-2 border-dashed border-gold/70"
          style={{ bottom: (dailyGoal / max) * H }}
        >
          <span className="absolute -top-5 left-0 text-xs font-semibold text-muted">meta {dailyGoal}</span>
        </div>
        <div className="absolute inset-0 flex items-end justify-around border-b border-line">
          {values.map((v, i) => (
            <button
              key={days[i]}
              type="button"
              className="flex h-full w-full items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${weekday(days[i])}: ${v} XP`}
            >
              <span
                className={cn(
                  "w-full max-w-6 rounded-t transition-[height] duration-500",
                  i === shown ? "bg-sky" : "bg-sky/60",
                )}
                style={{ height: Math.max(v ? 3 : 0, (v / max) * H) }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-around text-xs text-muted">
        {days.map((d) => (
          <span key={d} className={cn("w-full text-center", d === today && "font-bold text-fg")}>
            {weekday(d)}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** GitHub-style activity heatmap (one hue, more practice = darker). */
function Heatmap({ progress }: { progress: Progress }) {
  const WEEKS = 20;
  const today = dayKey();
  const todayDow = (new Date().getDay() + 6) % 7; // Monday = 0
  const start = addDays(today, -(WEEKS - 1) * 7 - todayDow);
  const level = (xp: number) => (xp <= 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4);
  const FILL = ["bg-surface-2", "bg-ok/30", "bg-ok/55", "bg-ok/80", "bg-ok"];
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Card>
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {hover ? (
          <>
            <b className="text-fg">{formatDay(hover)}</b>: {progress.days[hover]?.xp ?? 0} XP ·{" "}
            {progress.days[hover]?.answered ?? 0} ejercicios
          </>
        ) : (
          "Toca un día para ver el detalle."
        )}
      </p>
      <div
        className="grid max-w-[36rem] gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: WEEKS }, (_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, d) => {
              const key = addDays(start, w * 7 + d);
              if (key > today) return <span key={d} className="aspect-square w-full" />;
              const xp = progress.days[key]?.xp ?? 0;
              return (
                <button
                  key={d}
                  type="button"
                  title={`${formatDay(key)}: ${xp} XP`}
                  onMouseEnter={() => setHover(key)}
                  onClick={() => setHover(key)}
                  className={cn(
                    "aspect-square w-full rounded-[3px]",
                    FILL[level(xp)],
                    key === today && "ring-2 ring-sky ring-offset-1 ring-offset-surface",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-xs text-muted">
        Menos{" "}
        {FILL.map((f) => (
          <span key={f} className={cn("h-3 w-3 rounded-[3px]", f)} />
        ))}{" "}
        Más
      </div>
    </Card>
  );
}

export default function ProgressPage() {
  const ready = useReady();
  const progress = useProgress();
  if (!ready)
    return (
      <div>
        <PageHeader title="Tu progreso" />
        <Skeleton className="h-32 rounded-3xl" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-48 rounded-3xl" />
      </div>
    );

  const xp = totalXp(progress);
  const level = levelInfo(xp);
  const streak = streakInfo(progress);
  const days = Object.values(progress.days);
  const answered = days.reduce((n, d) => n + d.answered, 0);
  const correct = days.reduce((n, d) => n + d.correct, 0);
  const minutes = Math.round(days.reduce((n, d) => n + d.ms, 0) / 60000);
  const learned = VOCAB.filter((w) => isLearned(progress, w.id)).length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Tu progreso" />

      <Card className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl border-b-[6px] border-gold-strong bg-gold text-white">
          <span className="text-center leading-none">
            <span className="block text-xs font-bold uppercase">Nivel</span>
            <span className="text-4xl font-black">{level.level}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-black tabular-nums">
            {xp} <span className="text-base font-bold text-muted">XP</span>
          </p>
          <ProgressBar value={level.ratio} className="mt-2" barClassName="bg-gold" />
          <p className="mt-1 text-sm text-muted">
            {level.span - level.into} XP para el nivel {level.level + 1}
          </p>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile icon={<Flame size={14} />} label="Racha" value={`${streak.current} d`} />
        <StatTile icon={<Trophy size={14} />} label="Mejor racha" value={`${streak.best} d`} />
        <StatTile icon={<BookCheck size={14} />} label="Aprendidas" value={`${learned}/${VOCAB.length}`} />
        <StatTile
          icon={<Target size={14} />}
          label="Precisión"
          value={answered ? `${Math.round((correct / answered) * 100)}%` : "—"}
        />
        <StatTile
          icon={<Clock size={14} />}
          label="Tiempo"
          value={minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`}
        />
        <StatTile icon={<Zap size={14} />} label="Ejercicios" value={`${answered}`} />
      </div>

      <SectionTitle>Últimos 7 días</SectionTitle>
      <WeekChart progress={progress} />

      <SectionTitle>Actividad</SectionTitle>
      <Heatmap progress={progress} />

      <SectionTitle>Áreas</SectionTitle>
      <Card className="flex flex-col gap-3">
        {SKILLS.map((skill) => {
          const value = skillMastery(progress, VOCAB, skill.id);
          return (
            <div key={skill.id} className="flex items-center gap-3">
              <span
                lang="zh-CN"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 font-hanzi text-lg"
              >
                {skill.icon}
              </span>
              <span className="w-32 shrink-0 text-sm font-semibold">{skill.label}</span>
              <ProgressBar value={value} className="flex-1" barClassName="bg-gold" />
              <span className="w-10 text-right text-sm text-muted tabular-nums">
                {Math.round(value * 100)}%
              </span>
            </div>
          );
        })}
        <p className="text-xs text-muted">
          Dominio medio de tus palabras en cada área (sube con repasos espaciados en días distintos).
        </p>
      </Card>

      <SectionTitle>Lecciones</SectionTitle>
      <div className="flex flex-col gap-2">
        {LESSONS.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/leccion?id=${lesson.id}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2"
          >
            <span className="w-24 shrink-0 font-bold">Lección {lesson.number}</span>
            <Stars count={lessonStars(progress, lesson)} />
            <ProgressBar value={lessonMastery(progress, lesson)} className="flex-1" barClassName="bg-gold" />
            <span className="w-12 text-right text-xs text-muted">
              {progress.lessons[lesson.id]?.sessions ?? 0} ses.
            </span>
          </Link>
        ))}
      </div>

      <SectionTitle>
        <span id="examenes" className="scroll-mt-20">
          Exámenes
        </span>
      </SectionTitle>
      {progress.exams.length ? (
        <div className="flex flex-col gap-2">
          {[...progress.exams].reverse().map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <span
                className={cn("w-14 text-center text-2xl font-black", e.grade >= 5 ? "text-ok" : "text-bad")}
              >
                {e.grade.toLocaleString("es-ES")}
              </span>
              <span className="flex-1 text-sm">
                <b>{formatDay(e.date.slice(0, 10))}</b> · {e.correct}/{e.total} correctas
                <span className="block text-muted">
                  {e.lessons.length ? `${e.lessons.length} lección(es)` : "Todas las lecciones"}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Aún no has hecho ningún examen.{" "}
          <Link href="/practicar#examen" className="text-sky underline">
            Hacer uno
          </Link>
        </p>
      )}

      <SectionTitle>Récords</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={<span>∞</span>} label="Modo infinito" value={`${progress.records.infinite}`} />
        <StatTile icon={<Flame size={14} />} label="Mejor combo" value={`${progress.records.combo}`} />
      </div>

      <SectionTitle>
        Logros · {Object.keys(progress.achievements).length}/{ACHIEVEMENTS.length}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = progress.achievements[a.id];
          return (
            <div
              key={a.id}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center",
                unlocked ? "border-gold bg-gold-soft" : "border-line bg-surface opacity-60",
              )}
            >
              <span className="grid h-12 place-items-center text-3xl" lang="zh-CN">
                {unlocked ? a.icon : <Lock size={24} className="text-muted" />}
              </span>
              <span className="text-sm font-extrabold">{a.title}</span>
              <span className="text-xs text-muted">{a.description}</span>
              {unlocked && (
                <span className="text-xs font-semibold text-gold-strong">
                  {formatDay(unlocked.slice(0, 10))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
