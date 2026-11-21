"use client";
/** /sesion?modo=…&l=lessons&id=words&n=count&estilo=…&escritura=1 */
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { SessionRunner } from "@/components/session/Player";
import { Skeleton } from "@/components/UI";
import { useExercises } from "@/lib/data/remote";
import type { SessionMode, SessionParams } from "@/lib/exercises/types";
import { useReady } from "@/lib/account/client";

const MODES: SessionMode[] = [
  "leccion",
  "repaso",
  "infinito",
  "examen",
  "escritura",
  "tarjetas",
  "escucha",
  "pronunciacion",
  "tonos",
  "frases",
];
const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function parseParams(sp: URLSearchParams): SessionParams {
  const mode = sp.get("modo") as SessionMode;
  const style = sp.get("estilo");
  return {
    mode: MODES.includes(mode) ? mode : "leccion",
    lessons: list(sp.get("l")),
    words: list(sp.get("id")),
    count: Number(sp.get("n")) || undefined,
    style: style === "guiado" || style === "libre" || style === "mixto" ? style : undefined,
    withWriting: sp.get("escritura") === "1",
  };
}

function SessionSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6" aria-busy>
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-4 flex-1 rounded-full" />
      </div>
      <Skeleton className="mt-8 h-7 w-2/3" />
      <Skeleton className="mx-auto mt-8 h-32 w-32 rounded-3xl" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function SessionLoader() {
  const sp = useSearchParams();
  const params = useMemo(() => parseParams(new URLSearchParams(sp.toString())), [sp]);
  const ready = useReady();
  const exercises = useExercises();
  const [run, setRun] = useState(0);
  if (!ready || exercises.loading) return <SessionSkeleton />;
  return (
    <SessionRunner
      key={`${sp.toString()}#${run}`}
      params={params}
      sets={exercises.data?.file.words ?? {}}
      onRestart={() => setRun((r) => r + 1)}
    />
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <SessionLoader />
    </Suspense>
  );
}
