"use client";
/** Downloads the "paquete para Claude" of a lesson (see lib/data/claude-pack.ts). */
import { Bot, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { claudePack } from "@/lib/data/claude-pack";
import { loadExercises, loadInstructions } from "@/lib/data/remote";
import { LESSONS } from "@/lib/data/vocab";
import type { Lesson } from "@/lib/types";
import { Button } from "./ui";

export function ClaudePackButton({ lesson, className }: { lesson: Lesson; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const [instructions, exercises] = await Promise.all([loadInstructions(), loadExercises()]);
      const text = claudePack({ instructions, lessons: LESSONS, lessonId: lesson.id, exercises: exercises.raw[lesson.id] ?? null });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      a.download = `claude-${lesson.id}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("No se pudo preparar el paquete (¿sin conexión?).");
    }
    setBusy(false);
  };
  return (
    <div className={className}>
      <Button variant="secondary" size="sm" onClick={() => void download()} disabled={busy}>
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Bot size={16} />} Paquete para Claude
      </Button>
      {error && <p className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}
