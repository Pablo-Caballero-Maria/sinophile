"use client";
/**
 * Tiny in-memory external store consumed with useSyncExternalStore. Used for
 * settings, progress and the account state (DRY).
 *
 * Nothing is persisted in the browser: the account layer (lib/account/client.ts)
 * loads the stores from the server with `load()` and saves local changes, which
 * it learns about through `onChange()`.
 * During prerender (no window) the initial value is served; pages use
 * useReady() (lib/account/client.ts) to show skeletons until the account is loaded.
 */
import { useSyncExternalStore } from "react";

export interface Store<T> {
  readonly initial: T;
  get(): T;
  /** A local change (the learner did something): notifies subscribers and change handlers. */
  set(next: T | ((current: T) => T)): void;
  /** Replaces the state with data that is already saved elsewhere: notifies subscribers only. */
  load(next: T): void;
  /** For React (useSyncExternalStore). */
  subscribe(listener: () => void): () => void;
  /** Called after every `set` with the new and the previous state. */
  onChange(handler: (next: T, prev: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const handlers = new Set<(next: T, prev: T) => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    initial,
    get: () => state,
    set(next) {
      const prev = state;
      state = typeof next === "function" ? (next as (c: T) => T)(state) : next;
      if (state === prev) return;
      emit();
      handlers.forEach((h) => h(state, prev));
    },
    load(next) {
      state = next;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onChange(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.initial);
}
