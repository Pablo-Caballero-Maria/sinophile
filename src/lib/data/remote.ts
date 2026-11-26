"use client";
/**
 * Runtime-loaded static data (copied to /public/data by scripts/prepare-data.ts):
 * exercises.json (the exercises.json of every lesson, keyed by lesson folder; it
 * grows every week). TanStack Query downloads it once per page load and keeps it;
 * `useExercises` exposes the loading state so pages can render skeletons.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ExercisesFile } from "../types";
import { z } from "../zod";
import { fetchJson } from "./fetch-json";
import { sanitizeAllExercises, type Issue } from "./validate";
import { LESSONS } from "./vocab";

export interface ExercisesData {
  file: ExercisesFile;
  issues: Issue[];
  /** Vocab ids without an exercise set. */
  missing: string[];
}

/** exercises.json: one entry per lesson folder, each checked in detail by validate.ts. */
const exercisesByFolder = z.record(z.string(), z.unknown());

/** exercises.json, checked against the lessons (validate.ts keeps every valid exercise). */
export const exercisesQuery = queryOptions({
  queryKey: ["exercises"],
  queryFn: async (): Promise<ExercisesData> =>
    sanitizeAllExercises(exercisesByFolder.parse(await fetchJson("/data/exercises.json")), LESSONS),
});

/** What the app works with when exercises.json can't be loaded: no exercises, and why. */
export const exercisesUnavailable = (error: unknown): ExercisesData => ({
  file: { version: 1, words: {} },
  issues: [{ level: "error", message: `No se pudieron cargar los ejercicios: ${String(error)}` }],
  missing: [],
});

export interface RemoteState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** The exercises; if they can't be loaded, none (with the reason among the issues). */
export function useExercises(): RemoteState<ExercisesData> {
  const query = useQuery(exercisesQuery);
  return {
    data: query.data ?? (query.error ? exercisesUnavailable(query.error) : null),
    error: query.error,
    loading: query.isPending,
  };
}
