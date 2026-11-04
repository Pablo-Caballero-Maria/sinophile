/**
 * "Paquete para Claude": one text file with everything Claude needs to write a
 * lesson's exercises.json (instructions + vocabulary of the earlier lessons +
 * the new lesson's vocab + its current exercises, if any), so the learner
 * uploads a single file to claude.ai instead of one per lesson. Pure.
 */
import type { Lesson } from "../types";
import { formatVocabFile } from "./format";

const RULE = "=".repeat(72);
const section = (title: string, body: string) => `${RULE}\n${title}\n${RULE}\n${body.trimEnd()}\n`;

export interface ClaudePackInput {
  instructions: string;
  /** All lessons in order. */
  lessons: Lesson[];
  lessonId: string;
  /** The lesson's exercises.json as written, or null when it does not exist yet. */
  exercises: unknown;
}

export function claudePack({ instructions, lessons, lessonId, exercises }: ClaudePackInput): string {
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) throw new Error(`No existe la lección ${lessonId}`);
  const lesson = lessons[index];
  const earlier = lessons.slice(0, index);
  const target = `data/${lesson.id}/exercises.json`;
  return [
    `PAQUETE PARA CLAUDE · lección ${lesson.number} (clase del ${lesson.id})\n` +
      `Tarea: sigue las instrucciones y devuelve el archivo completo ${target}.\n`,
    section("INSTRUCCIONES (data/instructions.txt)", instructions),
    section(
      "VOCABULARIO DE LAS LECCIONES ANTERIORES (ya conocido)",
      earlier.map((l) => `data/${l.id}/vocab.json\n${formatVocabFile(l.words)}`).join("\n\n") || "(ninguna: es la primera lección)",
    ),
    section(`LECCIÓN NUEVA: data/${lesson.id}/vocab.json`, formatVocabFile(lesson.words)),
    section(
      `EJERCICIOS QUE YA EXISTEN: ${target}`,
      exercises === null || exercises === undefined ? "(todavía no existe: créalo entero)" : JSON.stringify(exercises, null, 2),
    ),
  ].join("\n");
}
