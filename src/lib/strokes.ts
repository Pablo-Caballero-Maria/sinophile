"use client";
/**
 * Stroke-order data (Make Me a Hanzi / hanzi-writer-data, Arphic Public License).
 * Characters used in vocab/examples are copied to /strokes at build time;
 * anything else (dictionary lookups) falls back to the jsDelivr CDN.
 */
export interface StrokeData {
  /** SVG outline path per stroke, in a 1024 box with y pointing up (offset 900). */
  strokes: string[];
  /** Centre line per stroke: [[x, y], …] in the same coordinates. */
  medians: number[][][];
  radStrokes?: number[];
}

const CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";
const cache = new Map<string, Promise<StrokeData>>();

async function fetchStrokes(url: string): Promise<StrokeData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as StrokeData;
}

export function loadStrokes(char: string): Promise<StrokeData> {
  if (!cache.has(char)) {
    const file = `${encodeURIComponent(char)}.json`;
    const promise = fetchStrokes(`/strokes/${file}`).catch(() => fetchStrokes(`${CDN}/${file}`));
    promise.catch(() => cache.delete(char));
    cache.set(char, promise);
  }
  return cache.get(char)!;
}

/** Adapter for HanziWriter's `charDataLoader` option. */
export const hanziWriterLoader = (char: string, onLoad: (data: StrokeData) => void, onError: (e: unknown) => void) => {
  loadStrokes(char).then(onLoad, onError);
};

/** SVG transform that maps the data's coordinates to a 0..1024 screen box. */
export const STROKE_TRANSFORM = "scale(1, -1) translate(0, -900)";
