"use client";
/**
 * Runtime-loaded static data (copied to /public/data by scripts/prepare-data.ts):
 * exercises.json (the exercises.json of every lesson, keyed by lesson; it grows
 * every week) and instructions.txt (for the Claude package). Each file is fetched
 * at most once per page load; `useRemote` exposes loading state so pages can
 * render skeletons.
 */
import { useEffect, useState } from "react";
import type { ExercisesFile } from "../types";
import { sanitizeAllExercises, type Issue } from "./validate";
import { LESSONS } from "./vocab";

const cache = new Map<string, Promise<unknown>>();

function fetchOnce(path: string, as: "json" | "text"): Promise<unknown> {
  if (!cache.has(path)) {
    const promise = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return as === "json" ? r.json() : r.text();
    });
    promise.catch(() => cache.delete(path)); // allow retry after a failure
    cache.set(path, promise);
  }
  return cache.get(path)!;
}

export interface ExercisesData {
  file: ExercisesFile;
  issues: Issue[];
  /** Vocab ids without an exercise set. */
  missing: string[];
  /** The exercises.json files as written, keyed by lesson id (for the Claude package). */
  raw: Record<string, unknown>;
}

let exercisesPromise: Promise<ExercisesData> | null = null;
export function loadExercises(): Promise<ExercisesData> {
  exercisesPromise ??= (fetchOnce("/data/exercises.json", "json") as Promise<Record<string, unknown>>)
    .then((raw) => ({ ...sanitizeAllExercises(raw, LESSONS), raw }))
    .catch((error) => {
      exercisesPromise = null;
      console.warn("[sinophile] exercises.json no disponible:", error);
      const issues: Issue[] = [{ level: "error", message: `No se pudieron cargar los ejercicios: ${String(error)}` }];
      return { file: { version: 1, words: {} }, issues, missing: [], raw: {} };
    });
  return exercisesPromise;
}

/** data/instructions.txt (how Claude writes exercises.json). */
export const loadInstructions = (): Promise<string> => fetchOnce("/data/instructions.txt", "text") as Promise<string>;

export interface RemoteState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** Generic hook: runs `loader` once on mount. */
export function useRemote<T>(loader: () => Promise<T>): RemoteState<T> {
  const [state, setState] = useState<RemoteState<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    loader().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error: Error) => alive && setState({ data: null, error, loading: false }),
    );
    return () => {
      alive = false;
    };
  }, [loader]);
  return state;
}

export const useExercises = () => useRemote(loadExercises);
