"use client";
/**
 * Stroke-order data (Make Me a Hanzi / hanzi-writer-data, Arphic Public License).
 * Characters used in vocab/examples are copied to /strokes at build time;
 * anything else (dictionary lookups) falls back to the jsDelivr CDN.
 *
 * Loaded through TanStack Query's client (one download per character, shared by every
 * component and by HanziWriter) and checked with zod: a CDN's answer isn't trusted blindly.
 */
import { queryOptions } from "@tanstack/react-query";
import { fetchJson } from "./data/fetch-json";
import { getQueryClient } from "./query";
import { z } from "./zod";

import { STROKES_CDN } from "./strokes-cdn";

const point = z.tuple([z.number(), z.number()]);

export const strokeDataSchema = z.object({
  /** SVG outline path per stroke, in a 1024 box with y pointing up (offset 900). */
  strokes: z.array(z.string()).min(1),
  /** Centre line per stroke: [[x, y], …] in the same coordinates. */
  medians: z.array(z.array(point)),
  radStrokes: z.array(z.number()).optional(),
});

export type StrokeData = z.infer<typeof strokeDataSchema>;

async function fetchStrokes(url: string): Promise<StrokeData> {
  return strokeDataSchema.parse(await fetchJson(url));
}

/** A character's strokes: from this site, or else from the CDN. */
export const strokesQuery = (char: string) =>
  queryOptions({
    queryKey: ["strokes", char],
    queryFn: () => {
      const file = `${encodeURIComponent(char)}.json`;
      return fetchStrokes(`/strokes/${file}`).catch(() => fetchStrokes(`${STROKES_CDN}/${file}`));
    },
  });

export const loadStrokes = (char: string): Promise<StrokeData> =>
  getQueryClient().fetchQuery(strokesQuery(char));

/** Adapter for HanziWriter's `charDataLoader` option. */
export const hanziWriterLoader = (
  char: string,
  onLoad: (data: StrokeData) => void,
  onError: (e: unknown) => void,
) => {
  loadStrokes(char).then(onLoad, onError);
};

/** SVG transform that maps the data's coordinates to a 0..1024 screen box. */
export const STROKE_TRANSFORM = "scale(1, -1) translate(0, -900)";
