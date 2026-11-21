/**
 * Pinyin utilities: tone marks <-> tone numbers, tolerant comparison,
 * syllable splitting (for tone colouring) and tone-variant generation
 * (for multiple-choice distractors).
 *
 * This module has NO imports on purpose: it is also loaded directly by the
 * Node build scripts (via native TypeScript type stripping).
 */

export type Tone = 1 | 2 | 3 | 4 | 5;

/** Base vowel -> [tone1, tone2, tone3, tone4] marked forms. */
const MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
  A: ["Ā", "Á", "Ǎ", "À"],
  E: ["Ē", "É", "Ě", "È"],
  I: ["Ī", "Í", "Ǐ", "Ì"],
  O: ["Ō", "Ó", "Ǒ", "Ò"],
  U: ["Ū", "Ú", "Ǔ", "Ù"],
  Ü: ["Ǖ", "Ǘ", "Ǚ", "Ǜ"],
};

/** Marked vowel -> { base, tone }. Built once from MARKS. */
const UNMARK = new Map<string, { base: string; tone: Tone }>();
for (const [base, forms] of Object.entries(MARKS)) {
  forms.forEach((form, i) => UNMARK.set(form, { base, tone: (i + 1) as Tone }));
}

const VOWELS = "aeiouüvAEIOUÜV" + [...UNMARK.keys()].join("");

/** Regex matching one pinyin syllable (tone-marked or plain). See splitSyllables. */
const SYLLABLE_RE = new RegExp(
  `(?:[zcsZCS]h|[bpmfdtnlgkhjqxrzcsywBPMFDTNLGKHJQXRZCSYW])?[${VOWELS}]+(?:ng(?![${VOWELS}])|n(?![${VOWELS}])|r(?![${VOWELS}]))?`,
  "g",
);

/** Tone of a single syllable (5 = neutral). */
export function toneOf(syllable: string): Tone {
  for (const ch of syllable) {
    const hit = UNMARK.get(ch);
    if (hit) return hit.tone;
  }
  const digit = syllable.match(/[1-5]$/);
  return digit ? (Number(digit[0]) as Tone) : 5;
}

/** Removes tone marks: "nǐ hǎo" -> "ni hao" (ü is kept). */
export function stripTones(text: string): string {
  let out = "";
  for (const ch of text) out += UNMARK.get(ch)?.base ?? ch;
  return out;
}

/** Puts a tone mark on a plain syllable following the standard placement rules. */
export function markSyllable(syllable: string, tone: number): string {
  const plain = stripTones(syllable).replace(/u:|v/g, "ü").replace(/U:|V/g, "Ü");
  if (tone < 1 || tone > 4) return plain;
  const lower = plain.toLowerCase();
  let idx = lower.search(/[ae]/);
  if (idx < 0) idx = lower.indexOf("ou");
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ("aeiouü".includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return plain;
  const forms = MARKS[plain[idx]];
  return forms ? plain.slice(0, idx) + forms[tone - 1] + plain.slice(idx + 1) : plain;
}

/**
 * Converts numbered pinyin to tone marks.
 * "ni3 hao3" -> "nǐ hǎo"; with `join` the syllables are glued into one word
 * (adding an apostrophe before a/e/o): "Xi1 an1" -> "Xī'ān".
 */
export function numberedToMarked(text: string, join = false): string {
  const syllables = text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const m = token.match(/^([A-Za-züÜ:]+)([1-5])$/);
      return m ? markSyllable(m[1], Number(m[2])) : token.replace(/u:/g, "ü");
    });
  if (!join) return syllables.join(" ");
  return syllables.reduce((acc, syl, i) => {
    const needsApostrophe = i > 0 && /^[aeoāáǎàēéěèōóǒò]/i.test(syl);
    return acc + (needsApostrophe ? "'" : "") + syl;
  }, "");
}

/**
 * Canonical form used for tolerant comparison: base letters (lowercase,
 * ü written as v, no spaces/punctuation) plus the sequence of non-neutral
 * tones. Accepts tone marks ("lǎoshī") or numbers ("lao3shi1", "lao3 shi1").
 */
export function canonicalPinyin(text: string): { letters: string; tones: number[] } {
  const normalized = text.normalize("NFC").replace(/u:/gi, "ü");
  let letters = "";
  const tones: number[] = [];
  for (const ch of normalized) {
    const hit = UNMARK.get(ch);
    if (hit) {
      letters += hit.base.toLowerCase();
      tones.push(hit.tone);
    } else if (/[1-4]/.test(ch)) {
      tones.push(Number(ch));
    } else if (/[a-zü]/i.test(ch)) {
      letters += ch.toLowerCase();
    }
    // spaces, apostrophes, punctuation and neutral-tone digits (5/0) are ignored
  }
  return { letters: letters.replace(/ü/g, "v"), tones };
}

/** True when both strings spell the same pinyin (tones included unless ignored). */
export function pinyinEquals(a: string, b: string, ignoreTones = false): boolean {
  const ca = canonicalPinyin(a);
  const cb = canonicalPinyin(b);
  if (ca.letters !== cb.letters) return false;
  return ignoreTones || ca.tones.join() === cb.tones.join();
}

export interface Syllable {
  text: string;
  tone: Tone;
}

/** Splits pinyin into syllables: "Xībānyáyǔ" -> xī/bān/yá/yǔ (with tones). */
export function splitSyllables(pinyin: string): Syllable[] {
  return (pinyin.match(SYLLABLE_RE) ?? []).map((text) => ({ text, tone: toneOf(text) }));
}

/** Splits text into syllables and separators (for colouring while keeping spaces/punctuation). */
export function segmentPinyin(text: string): { text: string; tone: Tone | null }[] {
  const out: { text: string; tone: Tone | null }[] = [];
  let last = 0;
  for (const m of text.matchAll(SYLLABLE_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), tone: null });
    out.push({ text: m[0], tone: toneOf(m[0]) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), tone: null });
  return out;
}

/**
 * Tones per character of `hanzi`, or null when syllables and characters
 * cannot be aligned (unusual spelling). Erhua is supported: in 这儿 "zhèr"
 * the 儿 has no syllable of its own and takes the tone of the one it joins.
 * Names in Latin letters (我叫Pablo, "Wǒ jiào Pablo.") are not pinyin, so they
 * are left out of the pinyin before aligning.
 */
export function charTones(hanzi: string, pinyin: string): Tone[] | null {
  const chars = [...hanzi].filter((c) => /\p{Script=Han}/u.test(c));
  for (const name of hanzi.match(/[A-Za-z]+/g) ?? [])
    pinyin = pinyin.replace(new RegExp(`(?<!\\p{L})${name}(?!\\p{L})`, "u"), " ");
  const syllables = splitSyllables(pinyin);
  if (chars.length === syllables.length) return syllables.map((s) => s.tone);
  const tones: Tone[] = [];
  let next = 0;
  for (const char of chars) {
    const previous = syllables[next - 1];
    const erhua =
      char === "儿" && previous && /r$/i.test(previous.text) && !/^[eēéěè]r$/i.test(previous.text);
    if (erhua) tones.push(previous.tone);
    else if (next < syllables.length) tones.push(syllables[next++].tone);
    else return null;
  }
  return next === syllables.length ? tones : null;
}

/**
 * Plausible wrong spellings with altered tones, used as distractors.
 * "nǐ hǎo" -> ["ní hǎo", "nǐ hào", "nì háo", ...]. `random` defaults to Math.random.
 */
export function toneVariants(pinyin: string, count: number, random = Math.random): string[] {
  const chars = [...pinyin];
  let positions = chars.flatMap((ch, i) => (UNMARK.has(ch) ? [i] : []));
  if (positions.length === 0) {
    // Only neutral tones: give the first vowel a mark so variants exist.
    const first = chars.findIndex((ch) => "aeiouü".includes(ch.toLowerCase()));
    positions = first >= 0 ? [first] : [];
  }
  const variants = new Set<string>();
  const withTone = (src: string[], pos: number, tone: number) => {
    const base = UNMARK.get(src[pos])?.base ?? src[pos];
    const forms = MARKS[base];
    if (!forms) return src;
    const copy = [...src];
    copy[pos] = forms[tone - 1];
    return copy;
  };
  for (const pos of positions) {
    for (let tone = 1; tone <= 4; tone++) variants.add(withTone(chars, pos, tone).join(""));
  }
  // Two-syllable changes add variety for longer words.
  for (let a = 0; a < positions.length; a++) {
    for (let b = a + 1; b < positions.length; b++) {
      for (let t = 0; t < 3; t++) {
        const t1 = 1 + Math.floor(random() * 4);
        const t2 = 1 + Math.floor(random() * 4);
        variants.add(withTone(withTone(chars, positions[a], t1), positions[b], t2).join(""));
      }
    }
  }
  variants.delete(pinyin);
  const list = [...variants];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}

/** Converts user-typed numbered pinyin to marks for display ("ni3hao3" -> "nǐhǎo"). */
export function prettifyTyped(text: string): string {
  return text.replace(/([a-zü:]+)([1-5])/gi, (_, syl: string, tone: string) =>
    markSyllable(syl, Number(tone)),
  );
}
