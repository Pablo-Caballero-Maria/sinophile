"use client";
/**
 * Free-text translation Spanish ⇄ Chinese through public, key-less endpoints:
 * Google's public translate endpoint (primary) with MyMemory as fallback.
 * Results are sanity-checked (Chinese output must contain hanzi, Spanish must not).
 */
import { hasHan } from "./text";

export type Lang = "es" | "zh";

const CODES: Record<Lang, string> = { es: "es", zh: "zh-CN" };

async function google(text: string, from: Lang, to: Lang): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${CODES[from]}&tl=${CODES[to]}&q=${encodeURIComponent(text)}`;
  const data = (await (await fetch(url)).json()) as [[string, string][]];
  return data[0].map((part) => part[0]).join("");
}

async function myMemory(text: string, from: Lang, to: Lang): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${CODES[from]}|${CODES[to]}`;
  const data = (await (await fetch(url)).json()) as { responseStatus: number | string; responseData?: { translatedText?: string } };
  const out = data.responseData?.translatedText;
  if (Number(data.responseStatus) !== 200 || !out || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) throw new Error("mymemory");
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
