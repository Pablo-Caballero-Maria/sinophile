"use client";
/** End-of-session screen: XP, accuracy, exam grade, records, achievements, mistakes review. */
import { Clock, Flame, Target, UserRound, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "@/lib/account/client";
import type { Achievement } from "@/lib/progress/achievements";
import { finishSession, progressStore } from "@/lib/progress/store";
import { accuracy, examGrade, type SessionState } from "@/lib/exercises/session";
import type { Exercise, SessionParams } from "@/lib/exercises/types";
import { playSound } from "@/lib/sound";
import { dayKey, hasHan } from "@/lib/text";
import { Hanzi } from "../hanzi";
import { Button, ButtonLink, Card, cn } from "../ui";

/** Guards against recording a session twice (React StrictMode double-invokes initialisers). */
const finished = new Map<
  number,
  { unlocked: Achievement[]; previousRecord: number; bonus: number; ms: number }
>();

function gradeLabel(grade: number) {
  if (grade >= 10) return { label: "Matrícula de honor", color: "text-gold" };
  if (grade >= 9) return { label: "Sobresaliente", color: "text-ok" };
  if (grade >= 7) return { label: "Notable", color: "text-ok" };
  if (grade >= 5) return { label: "Aprobado", color: "text-sky" };
  return { label: "Suspenso", color: "text-bad" };
}

/** Short text describing what an exercise asked (for the exam review). */
function promptLabel(ex: Exercise): string {
  switch (ex.type) {
    case "choice":
    case "tiles":
    case "typing": {
      const p = ex.prompt;
      if (p.kind === "word") return p.word.hanzi;
      if (p.kind === "text") return p.text;
      if (p.kind === "audio") return "zh" in p.reveal ? p.reveal.zh.join("") : p.reveal.hanzi;
      return p.sentence.zh.join("");
    }
    case "write":
    case "flashcard":
      return ex.word.hanzi;
    case "speak":
      return ex.hanzi;
    default:
      return ex.instruction;
  }
}

function Tile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border-2 p-3", color)}>
      <span className="text-xs font-bold tracking-wide uppercase">{label}</span>
      <span className="mt-1 flex items-center gap-1 text-2xl font-black">
        {icon}
        {value}
      </span>
    </div>
  );
}

export function SessionSummary({
  state,
  params,
  exitHref,
  onRestart,
}: {
  state: SessionState;
  params: SessionParams;
  exitHref: string;
  onRestart: () => void;
}) {
  const account = useAccount();
  const acc = accuracy(state);
  const grade = examGrade(state);
  const isExam = params.mode === "examen";
  const isInfinite = params.mode === "infinito";
  /** Anything done at all; a free-drawing session has no graded answers (and so no accuracy). */
  const activity = state.answered + state.practiced;

  const [{ unlocked, previousRecord, bonus, ms }] = useState(() => {
    if (!finished.has(state.startedAt)) {
      const ms = Date.now() - state.startedAt;
      const previousRecord = progressStore.get().records.infinite;
      const perfect = !isExam && state.answered >= 8 && state.correct === state.answered;
      const bonus =
        state.answered === 0 ? 0 : isExam ? (grade >= 10 ? 50 : grade >= 5 ? 20 : 0) : perfect ? 20 : 0;
      const unlocked =
        activity === 0
          ? []
          : finishSession(
              {
                lessonId:
                  params.mode === "leccion" && params.lessons.length === 1 ? params.lessons[0] : undefined,
                accuracy: acc,
                ms,
                xpBonus: bonus,
                maxCombo: state.maxCombo,
                infiniteScore: isInfinite ? state.correct : undefined,
                exam: isExam
                  ? {
                      id: `exam-${state.startedAt}`,
                      date: new Date().toISOString(),
                      lessons: params.lessons,
                      total: state.answered,
                      correct: state.correct,
                      grade,
                      ms,
                    }
                  : undefined,
              },
              {
                mode: params.mode,
                total: state.answered,
                mistakes: state.answered - state.correct,
                finishedAt: new Date(),
                examGrade: isExam ? grade : undefined,
              },
            );
      finished.set(state.startedAt, { unlocked, previousRecord, bonus, ms });
    }
    return finished.get(state.startedAt)!;
  });

  const newRecord = isInfinite && state.correct > previousRecord;
  const celebrate = activity > 0 && (isExam ? grade >= 5 : isInfinite ? newRecord : acc >= 70);

  useEffect(() => {
    if (!celebrate) return;
    playSound("complete");
    void import("canvas-confetti").then(({ default: confetti }) =>
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.35 },
        colors: ["#d93a3f", "#e6a116", "#2f9e5b", "#2f7fe0"],
      }),
    );
  }, [celebrate]);

  const title = isExam
    ? "Resultado del examen"
    : isInfinite
      ? newRecord
        ? "¡Nuevo récord!"
        : "Fin de la partida"
      : activity === 0
        ? "Sesión terminada"
        : acc === 100 && state.answered > 0
          ? "¡Sesión perfecta!"
          : "¡Sesión completada!";
  const mistakes = state.log.filter((l) => !l.result.correct);
  const g = gradeLabel(grade);
  const minutes = Math.max(1, Math.round(ms / 60000));

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl animate-fade-in flex-col px-4 pt-10 pb-32">
      <h1 className="text-center text-3xl font-black">{title}</h1>
      <p className="mt-1 text-center text-muted">{dayKey()}</p>

      {isExam && (
        <div className="mt-6 flex flex-col items-center">
          <span className={cn("text-7xl font-black", g.color)}>{grade.toLocaleString("es-ES")}</span>
          <span className={cn("text-lg font-bold", g.color)}>{g.label}</span>
          <span className="text-sm text-muted">
            {state.correct} de {state.answered} correctas
          </span>
        </div>
      )}
      {isInfinite && (
        <p className="mt-6 text-center text-lg">
          Has conseguido <b>{state.correct}</b> aciertos. Récord:{" "}
          <b>{Math.max(previousRecord, state.correct)}</b>
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          icon={<Zap size={20} />}
          label="XP"
          value={`${state.xp + bonus}`}
          color="border-gold text-gold"
        />
        <Tile
          icon={<Target size={20} />}
          label="Precisión"
          value={state.answered > 0 ? `${acc}%` : "—"}
          color="border-ok text-ok"
        />
        <Tile
          icon={<Clock size={20} />}
          label="Tiempo"
          value={`${minutes} min`}
          color="border-sky text-sky"
        />
        <Tile
          icon={<Flame size={20} />}
          label="Combo"
          value={`${state.maxCombo}`}
          color="border-brand text-brand"
        />
      </div>
      {bonus > 0 && (
        <p className="mt-3 text-center text-sm font-semibold text-gold">
          Incluye +{bonus} XP de bonificación
        </p>
      )}

      {account.status !== "user" && activity > 0 && (
        <Link
          href="/cuenta"
          className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-sky/40 bg-sky-soft p-3 text-sm"
        >
          <UserRound size={22} className="shrink-0 text-sky" />
          <span>
            <b>Modo invitado:</b> este progreso se perderá al cerrar la app. Entra o crea una cuenta para
            guardarlo.
          </span>
        </Link>
      )}

      {unlocked.length > 0 && (
        <Card tone="gold" className="mt-6">
          <p className="mb-2 font-black text-gold-strong">🏆 ¡Logro desbloqueado!</p>
          {unlocked.map((a) => (
            <p key={a.id} className="flex items-center gap-2">
              <span className="text-2xl">{a.icon}</span>
              <span>
                <b>{a.title}</b> — {a.description}
              </span>
            </p>
          ))}
        </Card>
      )}

      {mistakes.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-extrabold">Para repasar</h2>
          <ul className="flex flex-col gap-2">
            {mistakes.map(({ exercise, result }, i) => (
              <li key={i} className="rounded-2xl border border-line bg-surface p-3 text-sm">
                <p className="text-muted">{exercise.instruction}</p>
                <p className="font-semibold">
                  {hasHan(promptLabel(exercise)) ? (
                    <Hanzi text={promptLabel(exercise)} className="text-lg" />
                  ) : (
                    promptLabel(exercise)
                  )}
                </p>
                {result.given && <p className="text-bad">✗ {result.given}</p>}
                {result.solution && <p className="text-ok">✓ {result.solution}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-line bg-bg/95">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 pt-3">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onRestart}>
            Repetir
          </Button>
          <ButtonLink href={exitHref} size="lg" className="flex-1">
            Continuar
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
