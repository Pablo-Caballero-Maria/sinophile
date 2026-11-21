"use client";
/** Hook around the lazily-downloaded CC-CEDICT index. */
import { useEffect, useState } from "react";
import { loadCedict, type DictIndex } from "./dictionary";

export interface CedictState {
  items: DictIndex | null;
  loading: boolean;
  error: string | null;
}

/** Starts downloading CC-CEDICT when `enabled` becomes true (and keeps it). */
export function useCedict(enabled: boolean): CedictState {
  const [state, setState] = useState<CedictState>({ items: null, loading: false, error: null });
  const shouldLoad = enabled && !state.items && !state.error;
  useEffect(() => {
    if (!shouldLoad) return;
    let alive = true;
    const timer = setTimeout(() => alive && setState((s) => ({ ...s, loading: true })), 0);
    loadCedict().then(
      (items) => alive && setState({ items, loading: false, error: null }),
      () =>
        alive &&
        setState({ items: null, loading: false, error: "No se pudo cargar el diccionario general." }),
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [shouldLoad]);
  return state;
}
