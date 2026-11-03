"use client";
/**
 * Runtime-loaded data (copied to /public/data by scripts/prepare-data.ts):
 * exercises.json (grows every day) and cedict.json (large dictionary).
 * Each file is fetched at most once per page load; `useRemote` exposes
 * loading state so pages can render skeletons.
 */
import { useEffect, useState } from "react";
import type { ExercisesFile } from "../types";
import { sanitizeExercises, type Issue } from "./validate";
import { VOCAB } from "./vocab";

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
  missing: string[];
}

let exercisesPromise: Promise<ExercisesData> | null = null;
export function loadExercises(): Promise<ExercisesData> {
  exercisesPromise ??= fetchJson("/data/exercises.json")
    .then((raw) => sanitizeExercises(raw, VOCAB))
    .catch((error) => {
      exercisesPromise = null;
      console.warn("[sinophile] exercises.json no disponible:", error);
      return { file: { version: 1, words: {} }, issues: [{ level: "error", message: String(error) }], missing: [] } as ExercisesData;
    });
  return exercisesPromise;
}

/** Progress snapshot committed in the repo (data/progress.json at build time). */
export const loadProgressSeed = (): Promise<unknown> => fetchJson("/data/progress.json").catch(() => null);

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
