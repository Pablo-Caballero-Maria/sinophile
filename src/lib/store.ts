"use client";
/**
 * The app's stores (settings, progress and the account state), each a zustand store with two ways
 * of changing it:
 *
 * - `set`: a local change (the learner did something). Subscribers re-render and the change
 *   handlers run: that's how the account layer (lib/account/client.ts) learns what to upload.
 * - `load`: data that is already saved elsewhere (the account, just downloaded). Subscribers
 *   re-render, nothing is uploaded.
 *
 * Nothing is persisted in the browser. During prerender the initial value is served (zustand's
 * server snapshot); pages use useReady() (lib/account/client.ts) to show skeletons until the
 * account is loaded.
 */
import { useStore as useZustandStore } from "zustand";
import { createStore as createZustandStore, type StoreApi } from "zustand/vanilla";

export interface Store<T> {
  readonly initial: T;
  get(): T;
  /** A local change (the learner did something): notifies subscribers and change handlers. */
  set(next: T | ((current: T) => T)): void;
  /** Replaces the state with data that is already saved elsewhere: notifies subscribers only. */
  load(next: T): void;
  /** Called on every change of the state (set or load). */
  subscribe(listener: () => void): () => void;
  /** Called after every `set` with the new and the previous state. */
  onChange(handler: (next: T, prev: T) => void): () => void;
  /** The zustand store underneath (for useStore). */
  readonly api: StoreApi<{ value: T }>;
}

export function createStore<T>(initial: T): Store<T> {
  const api = createZustandStore<{ value: T }>()(() => ({ value: initial }));
  const handlers = new Set<(next: T, prev: T) => void>();
  const get = () => api.getState().value;
  return {
    initial,
    api,
    get,
    set(next) {
      const prev = get();
      const value = typeof next === "function" ? (next as (current: T) => T)(prev) : next;
      if (value === prev) return;
      api.setState({ value });
      handlers.forEach((handler) => handler(value, prev));
    },
    load(value) {
      api.setState({ value });
    },
    subscribe: (listener) => api.subscribe(() => listener()),
    onChange(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

/**
 * The store's state in a component; with a selector, only that part (the component re-renders
 * only when it changes).
 */
export function useStore<T>(store: Store<T>): T;
export function useStore<T, S>(store: Store<T>, select: (state: T) => S): S;
export function useStore<T, S>(store: Store<T>, select?: (state: T) => S): T | S {
  return useZustandStore(store.api, (state) => (select ? select(state.value) : state.value));
}
