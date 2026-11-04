"use client";
/**
 * Runtime-loaded static data (copied to /public/data by scripts/prepare-data.ts):
 * exercises.json (the exercises.json of every lesson, keyed by lesson folder; it
 * grows every week). It is fetched at most once per page load; `useRemote`
 * exposes loading state so pages can render skeletons.
 */
import { useEffect, useState } from "react";
import type { ExercisesFile } from "../types";
import { sanitizeAllExercises, type Issue } from "./validate";
import { LESSONS } from "./vocab";

const cache = new Map<string, Promise<unknown>>();

function fetchJson(path: string): Promise<unknown> {
  if (!cache.has(path)) {
    const promise = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
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
}

let exercisesPromise: Promise<ExercisesData> | null = null;
export function loadExercises(): Promise<ExercisesData> {
  exercisesPromise ??= (fetchJson("/data/exercises.json") as Promise<Record<string, unknown>>)
    .then((raw) => sanitizeAllExercises(raw, LESSONS))
    .catch((error) => {
      exercisesPromise = null;
      console.warn("[sinophile] exercises.json no disponible:", error);
      const issues: Issue[] = [{ level: "error", message: `No se pudieron cargar los ejercicios: ${String(error)}` }];
      return { file: { version: 1, words: {} }, issues, missing: [] };
    });
  return exercisesPromise;
}

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
