"use client";
/**
 * Tiny external store persisted in localStorage, consumed with
 * useSyncExternalStore. Used for settings and progress (DRY).
 * During prerender (no window) the fallback value is served; components use
 * useHydrated() to show skeletons until the real data is available.
 */
import { useSyncExternalStore } from "react";

export interface PersistentStore<T> {
  get(): T;
  set(next: T | ((current: T) => T)): void;
  subscribe(listener: () => void): () => void;
  fallback: T;
}

export function createPersistentStore<T>(key: string, fallback: T, revive: (raw: unknown) => T): PersistentStore<T> {
  let state = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) state = revive(JSON.parse(raw));
    } catch {
      /* corrupted or blocked storage: keep fallback */
    }
  };

  return {
    fallback,
    get() {
      load();
      return state;
    },
    set(next) {
      load();
      state = typeof next === "function" ? (next as (c: T) => T)(state) : next;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* quota/private mode: state still lives in memory */
      }
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      // Keep several open tabs in sync.
      const onStorage = (e: StorageEvent) => {
        if (e.key !== key) return;
        loaded = false;
        load();
        emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export function useStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.fallback);
}

const noop = () => () => {};
/** false during prerender/hydration, true once running in the browser. */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
