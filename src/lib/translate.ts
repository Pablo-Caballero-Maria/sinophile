"use client";
/**
 * Free-text translation Spanish ⇄ Chinese through public, key-less endpoints:
 * Google's public translate endpoint (primary) with MyMemory as fallback.
 * Results are sanity-checked (Chinese output must contain hanzi, Spanish must not).
 */
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { hasHan } from "./text";
import { TRANSLATION_HOSTS } from "./translation-hosts";
import { z } from "./zod";

export type Lang = "es" | "zh";

const CODES: Record<Lang, string> = { es: "es", zh: "zh-CN" };

/** Google's answer: [[[translated piece, original piece, …], …], …]. Only the pieces are read. */
const googleSchema = z.tuple([z.array(z.tuple([z.string()]).rest(z.unknown()))]).rest(z.unknown());

const myMemorySchema = z.object({
  responseStatus: z.union([z.number(), z.string()]),
  responseData: z.object({ translatedText: z.string().optional() }).optional(),
});

async function google(text: string, from: Lang, to: Lang): Promise<string> {
  const url = `${TRANSLATION_HOSTS[0]}/translate_a/single?client=gtx&dt=t&sl=${CODES[from]}&tl=${CODES[to]}&q=${encodeURIComponent(text)}`;
  const [pieces] = googleSchema.parse(await (await fetch(url)).json());
  return pieces.map((piece) => piece[0]).join("");
}

async function myMemory(text: string, from: Lang, to: Lang): Promise<string> {
  const url = `${TRANSLATION_HOSTS[1]}/get?q=${encodeURIComponent(text)}&langpair=${CODES[from]}|${CODES[to]}`;
  const data = myMemorySchema.parse(await (await fetch(url)).json());
  const out = data.responseData?.translatedText;
  if (Number(data.responseStatus) !== 200 || !out || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out))
    throw new Error("mymemory");
  return out;
}

/** Rejects answers in the wrong script (e.g. an English word when Chinese was asked). */
const plausible = (out: string, to: Lang) => !!out.trim() && (to === "zh" ? hasHan(out) : !hasHan(out));

export async function translate(text: string, from: Lang, to: Lang): Promise<string> {
  const clean = text.trim().slice(0, 500);
  if (!clean) return "";
  for (const provider of [google, myMemory]) {
    try {
      const out = await provider(clean, from, to);
      if (plausible(out, to)) return out;
    } catch {
      /* try the next provider */
    }
  }
  throw new Error("No se pudo traducir (¿sin conexión?). Inténtalo más tarde.");
}

/** The translation of a fixed text (a word's page): asked once, then kept for the visit. */
export const translationQuery = (text: string, from: Lang, to: Lang) =>
  queryOptions({
    queryKey: ["translation", from, to, text.trim()],
    queryFn: () => translate(text, from, to),
    retry: false,
  });

export interface TranslationRequest {
  text: string;
  from: Lang;
  to: Lang;
}

/** Translating what the learner typed (the dictionary's translator). */
export const translateMutation = mutationOptions({
  mutationKey: ["translate"],
  mutationFn: ({ text, from, to }: TranslationRequest) => translate(text, from, to),
});
