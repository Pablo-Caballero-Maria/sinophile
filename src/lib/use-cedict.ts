"use client";
/** Hook around the lazily-downloaded CC-CEDICT index (TanStack Query: cedictQuery). */
import { useQuery } from "@tanstack/react-query";
import { cedictQuery, type DictIndex } from "./dictionary";

export interface CedictState {
  items: DictIndex | null;
  loading: boolean;
  error: string | null;
}

/** Starts downloading CC-CEDICT when `enabled` becomes true (and keeps it). */
export function useCedict(enabled: boolean): CedictState {
  const query = useQuery({ ...cedictQuery, enabled });
  return {
    items: query.data ?? null,
    loading: query.isLoading,
    error: query.isError ? "No se pudo cargar el diccionario general." : null,
  };
}
