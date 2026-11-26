/**
 * Builds practice sessions.
 *
 * Two sources of exercises:
 *  - automatic drills derived from vocab.json alone (meaning, listening, tones,
 *    matching, typing, writing, speaking, flashcards), so a new word is
 *    practicable the moment it is added;
 *  - curated exercises from exercises.json (fill-in, translations, dialogues,
 *    questions), written per word by Claude following data/instructions.txt.
 */
import { pinyinEquals, toneVariants } from "../pinyin";
import { isSeen, itemOf, wordMastery, dueItems, type Progress } from "../progress/model";
import { strength } from "../srs";
import {
  dayKey,
  hasHan,
  isPunctuation,
  normalizeLatin,
  normalizeZh,
  pick,
  sample,
  shuffle,
  spanishWords,
  splitMeanings,
  uniqueBy,
} from "../text";
import type { CuratedExercise, Sentence, Skill, VocabEntry, WordSet } from "../types";
import { isNoisyExercise, isNoisyMode, reviewable } from "./silent";
import {
  CARD_FRONTS,
  type CardFront,
  type Display,
  type Exercise,
  type Option,
  type Prompt,
  type SessionParams,
  type WriteStyle,
} from "./types";

export interface GenContext {
  /** Whole vocabulary (distractor pool). */
  vocab: VocabEntry[];
  sets: Record<string, WordSet>;
  progress: Progress;
  showPinyin: boolean;
  /** Include microphone exercises. */
  speaking: boolean;
  /** Silent mode: nothing that needs sound. */
  silent: boolean;
  sessionLength: number;
  random: () => number;
  today?: string;
}

let counter = 0;
const nextKey = (type: string) => `${type}-${++counter}`;

/* ───────────── helpers ───────────── */

/** Other words usable as wrong options, preferring the same lesson and similar length. */
function distractorWords(
  word: VocabEntry,
  ctx: GenContext,
  count: number,
  isConflict: (w: VocabEntry) => boolean,
): VocabEntry[] {
  const candidates = uniqueBy(
    shuffle(ctx.vocab, ctx.random).filter(
      (w) => w.id !== word.id && w.hanzi !== word.hanzi && !isConflict(w),
    ),
    (w) => w.hanzi,
  );
  const score = (w: VocabEntry) =>
    (w.lesson === word.lesson ? 0 : 1) + Math.abs(w.hanzi.length - word.hanzi.length) * 0.5;
  return candidates.sort((a, b) => score(a) - score(b)).slice(0, count);
}

/** Shares at least one meaning ("hijos (general)" and "niño; hijos"), so it can't be a wrong option. */
const sameMeaning = (a: VocabEntry, b: VocabEntry) => {
  const meanings = new Set(splitMeanings(a.es).map(normalizeLatin));
  return splitMeanings(b.es).some((m) => meanings.has(normalizeLatin(m)));
};
const sameSound = (a: VocabEntry, b: VocabEntry) => pinyinEquals(a.pinyin, b.pinyin, true);
const hanziOption = (w: VocabEntry): Option => ({
  id: w.id,
  display: { kind: "hanzi", text: w.hanzi, pinyin: w.pinyin },
});
const textDisplay = (text: string): Display =>
  hasHan(text)
    ? { kind: "hanzi", text }
    : /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(text)
      ? { kind: "pinyin", text }
      : { kind: "text", text };

const base = (type: string, skill: Skill, word: VocabEntry, instruction: string) => ({
  key: nextKey(type),
  skill,
  wordIds: [word.id],
  instruction,
});

/* ───────────── automatic drills ───────────── */

export function intro(word: VocabEntry, ctx: GenContext): Exercise {
  const set = ctx.sets[word.id];
  return {
    ...base("intro", "meaning", word, "Palabra nueva"),
    type: "intro",
    word,
    note: set?.note,
    example: set?.examples.find((s) => s.zh.length > 0),
  };
}

export function meaningChoice(word: VocabEntry, ctx: GenContext, showPinyin = ctx.showPinyin): Exercise {
  const options = shuffle([word, ...distractorWords(word, ctx, 3, (w) => sameMeaning(w, word))], ctx.random);
  return {
    ...base("meaning", "meaning", word, "¿Qué significa?"),
    type: "choice",
    prompt: { kind: "word", word, showPinyin },
    options: options.map((w) => ({ id: w.id, display: { kind: "text", text: w.es } })),
    answerId: word.id,
  };
}

export function reverseChoice(word: VocabEntry, ctx: GenContext): Exercise {
  const options = shuffle([word, ...distractorWords(word, ctx, 3, (w) => sameMeaning(w, word))], ctx.random);
  return {
    ...base("reverse", "meaning", word, "¿Cómo se dice en chino?"),
    type: "choice",
    prompt: { kind: "text", text: word.es },
    options: options.map(hanziOption),
    answerId: word.id,
  };
}

export function listenChoice(word: VocabEntry, ctx: GenContext): Exercise {
  const options = shuffle([word, ...distractorWords(word, ctx, 3, (w) => sameSound(w, word))], ctx.random);
  return {
    ...base("listen", "listening", word, "Escucha y elige lo que oyes"),
    type: "choice",
    prompt: { kind: "audio", speak: word.hanzi, reveal: word },
    options: options.map(hanziOption),
    answerId: word.id,
  };
}

export function listenMeaning(word: VocabEntry, ctx: GenContext): Exercise {
  const options = shuffle(
    [word, ...distractorWords(word, ctx, 3, (w) => sameMeaning(w, word) || sameSound(w, word))],
    ctx.random,
  );
  return {
    ...base("listen-meaning", "listening", word, "Escucha y elige el significado"),
    type: "choice",
    prompt: { kind: "audio", speak: word.hanzi, reveal: word },
    options: options.map((w) => ({ id: w.id, display: { kind: "text", text: w.es } })),
    answerId: word.id,
  };
}

export function pinyinChoice(word: VocabEntry, ctx: GenContext): Exercise {
  let wrong = toneVariants(word.pinyin, 3, ctx.random);
  if (wrong.length < 3) {
    const fill = distractorWords(word, ctx, 3, (w) => sameSound(w, word)).map((w) => w.pinyin);
    wrong = [...wrong, ...fill].slice(0, 3);
  }
  const options: Option[] = shuffle(
    [
      { id: "ok", display: { kind: "pinyin", text: word.pinyin } },
      ...wrong.map((p, i) => ({ id: `v${i}`, display: { kind: "pinyin", text: p } as Display })),
    ],
    ctx.random,
  );
  return {
    ...base("pinyin", "pinyin", word, "¿Cómo se pronuncia?"),
    type: "choice",
    prompt: { kind: "word", word, showPinyin: false },
    options,
    answerId: "ok",
  };
}

export const typePinyin = (word: VocabEntry): Exercise => ({
  ...base("type-pinyin", "pinyin", word, "Escribe el pinyin con tonos (nǐ hǎo o ni3 hao3)"),
  type: "typing",
  prompt: { kind: "word", word, showPinyin: false },
  mode: "pinyin",
  answers: [word.pinyin],
  solution: word.pinyin,
});

export const typeMeaning = (word: VocabEntry, ctx: GenContext): Exercise => ({
  ...base("type-meaning", "meaning", word, "Escribe el significado en español"),
  type: "typing",
  prompt: { kind: "word", word, showPinyin: ctx.showPinyin },
  mode: "es",
  answers: [word.es, ...splitMeanings(word.es)],
  solution: word.es,
});

/** Matching game with up to 5 pairs (hanzi ↔ Spanish, or hanzi ↔ pinyin). */
export function matchPairs(
  words: VocabEntry[],
  ctx: GenContext,
  variant: "es" | "pinyin" = pick(["es", "es", "pinyin"], ctx.random) as "es" | "pinyin",
): Exercise | null {
  const right = (w: VocabEntry) => (variant === "es" ? normalizeLatin(w.es) : normalizeLatin(w.pinyin));
  const chosen = uniqueBy(
    uniqueBy(words, (w) => w.hanzi),
    right,
  ).slice(0, 5);
  if (chosen.length < 3) return null;
  return {
    key: nextKey("match"),
    skill: variant === "es" ? "meaning" : "pinyin",
    wordIds: chosen.map((w) => w.id),
    instruction:
      variant === "es" ? "Empareja cada palabra con su significado" : "Empareja cada palabra con su pinyin",
    type: "match",
    pairs: chosen.map((w) => ({
      wordId: w.id,
      left: { kind: "hanzi", text: w.hanzi },
      right: variant === "es" ? { kind: "text", text: w.es } : { kind: "pinyin", text: w.pinyin },
    })),
  };
}

const WRITE_INSTRUCTIONS: Record<WriteStyle, (word: VocabEntry) => string> = {
  guided: () => "Traza siguiendo el orden de los trazos",
  free: () => "Dibuja de memoria",
  graded: (word) => `Escribe de memoria: «${word.es}»`,
};

export const write = (word: VocabEntry, style: WriteStyle): Exercise => ({
  ...base(style === "guided" ? "write" : "draw", "writing", word, WRITE_INSTRUCTIONS[style](word)),
  type: "write",
  word,
  style,
});

export const speakWord = (word: VocabEntry): Exercise => ({
  ...base("speak", "speaking", word, "Pronuncia en voz alta"),
  type: "speak",
  hanzi: word.hanzi,
  pinyin: word.pinyin,
  translation: word.es,
});

export const speakSentence = (word: VocabEntry, sentence: Sentence): Exercise => ({
  ...base("speak", "speaking", word, "Lee la frase en voz alta"),
  type: "speak",
  hanzi: sentence.zh.join(""),
  pinyin: sentence.pinyin,
  translation: sentence.es,
});

/** What each flashcard face asks, and the skill it trains (hearing the word is listening). */
const CARD_PROMPTS: Record<CardFront, { instruction: string; skill: Skill }> = {
  es: { instruction: "¿Cómo se dice en chino?", skill: "meaning" },
  hanzi: { instruction: "¿Cómo se lee y qué significa?", skill: "meaning" },
  pinyin: { instruction: "¿Qué palabra es?", skill: "pinyin" },
  audio: { instruction: "¿Qué palabra has oído?", skill: "listening" },
};

export const flashcard = (word: VocabEntry, front: CardFront): Exercise => ({
  ...base("card", CARD_PROMPTS[front].skill, word, CARD_PROMPTS[front].instruction),
  type: "flashcard",
  word,
  front,
});

/** The faces flashcards can start with now: all but the audio one in silent mode. */
export const cardFronts = (silent: boolean): CardFront[] =>
  CARD_FRONTS.filter((front) => !silent || front !== "audio");

/** Listen to an example sentence and rebuild it with tiles. */
export function dictation(word: VocabEntry, sentence: Sentence, ctx: GenContext): Exercise {
  const tokens = sentence.zh.filter((t) => !isPunctuation(t));
  const extra = distractorWords(word, ctx, 2, (w) => tokens.includes(w.hanzi)).map((w) => w.hanzi);
  return {
    ...base("dictation", "listening", word, "Escucha y ordena la frase"),
    type: "tiles",
    prompt: { kind: "audio", speak: sentence.zh.join(""), reveal: sentence },
    lang: "zh",
    tiles: shuffle([...tokens, ...extra], ctx.random),
    answers: [normalizeZh(sentence.zh.join(""))],
    solution: sentence.zh.join(""),
  };
}

/* ───────────── curated (exercises.json) ───────────── */

function curated(word: VocabEntry, set: WordSet, ex: CuratedExercise, ctx: GenContext): Exercise | null {
  const sentenceOf = (i: number) => (set.examples[i]?.zh.length ? set.examples[i] : null);
  switch (ex.type) {
    case "fill": {
      const sentence = sentenceOf(ex.example);
      const blankToken = ex.blank ?? word.hanzi;
      const blank = sentence?.zh.indexOf(blankToken) ?? -1;
      if (!sentence || blank < 0) return null;
      const wrong = ex.distractors?.length
        ? ex.distractors
        : distractorWords(word, ctx, 3, (w) => w.hanzi === blankToken).map((w) => w.hanzi);
      const options = shuffle(
        uniqueBy([blankToken, ...wrong.filter((d) => d !== blankToken)].slice(0, 4), (t) => t),
        ctx.random,
      );
      return {
        ...base("fill", "sentences", word, "Completa la frase"),
        type: "choice",
        prompt: { kind: "sentence", sentence, blank, showTranslation: true },
        options: options.map((t) => ({ id: t, display: { kind: "hanzi", text: t } })),
        answerId: blankToken,
      };
    }
    case "translate": {
      const sentence = sentenceOf(ex.example);
      if (!sentence) return null;
      if (ex.direction === "zh-es") {
        const words = spanishWords(sentence.es);
        const pool = Object.values(ctx.sets).flatMap((s) => s.examples.flatMap((e) => spanishWords(e.es)));
        const wordsNorm = new Set(words.map(normalizeLatin));
        const extra = ex.distractors?.length
          ? ex.distractors
          : sample(
              uniqueBy(
                pool.filter((w) => !wordsNorm.has(normalizeLatin(w))),
                normalizeLatin,
              ),
              3,
              ctx.random,
            );
        return {
          ...base("translate", "sentences", word, "Traduce al español"),
          type: "tiles",
          prompt: { kind: "sentence", sentence, showTranslation: false },
          lang: "es",
          tiles: shuffle([...words, ...extra], ctx.random),
          answers: [sentence.es, ...(ex.accept ?? [])].map(normalizeLatin),
          solution: sentence.es,
        };
      }
      const tokens = sentence.zh.filter((t) => !isPunctuation(t));
      const extra = ex.distractors?.length
        ? ex.distractors
        : distractorWords(word, ctx, 2, (w) => tokens.includes(w.hanzi)).map((w) => w.hanzi);
      return {
        ...base("translate", "sentences", word, "Traduce al chino"),
        type: "tiles",
        prompt: { kind: "text", text: sentence.es },
        lang: "zh",
        tiles: shuffle([...tokens, ...extra], ctx.random),
        // e.g. time words may go before or after the subject: 星期一我有考试 / 我星期一有考试
        answers: [sentence.zh.join(""), ...(ex.accept ?? [])].map(normalizeZh),
        solution: sentence.zh.join(""),
      };
    }
    case "dialogue": {
      const options = shuffle(
        [ex.answer, ...ex.wrong].map((s, i) => ({
          id: i === 0 ? "answer" : `w${i}`,
          display: { kind: "hanzi", text: s.zh.join(""), pinyin: s.pinyin } as Display,
        })),
        ctx.random,
      );
      return {
        ...base("dialogue", "sentences", word, "Elige la respuesta adecuada"),
        type: "choice",
        prompt: { kind: "sentence", sentence: ex.prompt, showTranslation: false },
        options,
        answerId: "answer",
        explanation: `«${ex.prompt.es}» → «${ex.answer.es}»`,
      };
    }
    case "choice": {
      const options = shuffle(
        ex.options.map((o) => ({ id: o, display: textDisplay(o) })),
        ctx.random,
      );
      return {
        ...base("question", "sentences", word, "Elige la respuesta correcta"),
        type: "choice",
        prompt: { kind: "text", text: ex.question },
        options,
        answerId: ex.answer,
        explanation: ex.explanation,
      };
    }
  }
}

/** All curated exercises available for a word (possibly empty). */
export function curatedFor(word: VocabEntry, ctx: GenContext): Exercise[] {
  const set = ctx.sets[word.id];
  if (!set) return [];
  return set.exercises.map((ex) => curated(word, set, ex, ctx)).filter((e): e is Exercise => e !== null);
}

const examplesOf = (word: VocabEntry, ctx: GenContext) =>
  (ctx.sets[word.id]?.examples ?? []).filter((s) => s.zh.length > 0);

/* ───────────── per-skill drill choice ───────────── */

export function drillFor(word: VocabEntry, skill: Skill, ctx: GenContext): Exercise {
  const box = itemOf(ctx.progress, word.id, skill)?.b ?? 0;
  const r = ctx.random;
  switch (skill) {
    case "meaning":
      return pick(
        [box >= 3 ? typeMeaning(word, ctx) : meaningChoice(word, ctx), reverseChoice(word, ctx)],
        r,
      );
    case "listening": {
      const examples = examplesOf(word, ctx);
      const options = [listenChoice(word, ctx), listenMeaning(word, ctx)];
      if (examples.length && box >= 2) options.push(dictation(word, pick(examples, r), ctx));
      return pick(options, r);
    }
    case "pinyin":
      return box >= 3 ? typePinyin(word) : pinyinChoice(word, ctx);
    case "writing":
      // Spaced repetition needs a result to schedule the next review, so never free drawing.
      return write(word, "guided");
    case "speaking":
      return ctx.speaking ? speakWord(word) : listenChoice(word, ctx);
    case "sentences": {
      const list = curatedFor(word, ctx);
      return list.length ? pick(list, r) : reverseChoice(word, ctx);
    }
  }
}

/** In silent mode, swaps an exercise that needs sound for another drill of the same word. */
function silenced(exercise: Exercise, ctx: GenContext): Exercise {
  if (!ctx.silent || !isNoisyExercise(exercise)) return exercise;
  const word = ctx.vocab.find((w) => w.id === exercise.wordIds[0])!;
  return drillFor(word, pick<Skill>(["meaning", "pinyin", "sentences"], ctx.random), ctx);
}

/* ───────────── sessions ───────────── */

const weakestFirst = (words: VocabEntry[], ctx: GenContext, skill?: Skill) =>
  [...words].sort((a, b) =>
    skill
      ? strength(itemOf(ctx.progress, a.id, skill)) - strength(itemOf(ctx.progress, b.id, skill))
      : wordMastery(ctx.progress, a.id) - wordMastery(ctx.progress, b.id),
  );

function lessonSession(words: VocabEntry[], ctx: GenContext): Exercise[] {
  const r = ctx.random;
  const unseen = words.filter((w) => !isSeen(ctx.progress, w.id));
  const seen = weakestFirst(
    words.filter((w) => isSeen(ctx.progress, w.id)),
    ctx,
  );
  const focus = [...unseen.slice(0, 4), ...seen].slice(0, unseen.length ? 4 : 5);

  // Phase 1: introduce new words (each followed by an easy check), quick recall for known ones.
  const opening = focus.flatMap((w) =>
    isSeen(ctx.progress, w.id)
      ? [pick([meaningChoice(w, ctx), reverseChoice(w, ctx)], r)]
      : [intro(w, ctx), meaningChoice(w, ctx)],
  );

  // Phase 2: candidates in priority order, trimmed to the session length.
  const others = shuffle(
    words.filter((w) => !focus.includes(w)),
    r,
  );
  const match = matchPairs([...focus, ...others], ctx, "es");
  const writingWord = weakestFirst(focus, ctx, "writing")[0];
  const candidates = [
    ...(match ? [match] : []),
    ...focus.map((w) => pick([listenChoice(w, ctx), pinyinChoice(w, ctx), listenMeaning(w, ctx)], r)),
    ...shuffle(
      focus.flatMap((w) => sample(curatedFor(w, ctx), 1, r)),
      r,
    ),
    ...focus.map((w) => pick([reverseChoice(w, ctx), pinyinChoice(w, ctx)], r)),
  ];
  const room = Math.max(4, ctx.sessionLength - opening.length - 1 - (ctx.speaking ? 1 : 0));
  const tail = [
    ...shuffle(candidates.slice(0, room), r),
    write(writingWord, "guided"),
    ...(ctx.speaking ? [speakWord(pick(focus, r))] : []),
  ];
  return [...opening, ...tail];
}

function reviewSession(words: VocabEntry[], ctx: GenContext): Exercise[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  const due = reviewable(dueItems(ctx.progress, new Set(byId.keys()), ctx.today ?? dayKey()), ctx.silent)
    .filter((d) => d.skill !== "speaking" || ctx.speaking)
    .slice(0, ctx.sessionLength);
  if (due.length > 0)
    return shuffle(
      due.map((d) => drillFor(byId.get(d.wordId)!, d.skill, ctx)),
      ctx.random,
    );
  // Nothing due: practise the weakest words already seen.
  const seen = weakestFirst(
    words.filter((w) => isSeen(ctx.progress, w.id)),
    ctx,
  ).slice(0, ctx.sessionLength);
  return seen.map((w) =>
    drillFor(w, pick(["meaning", "listening", "pinyin", "sentences"] as Skill[], ctx.random), ctx),
  );
}

function examSession(words: VocabEntry[], ctx: GenContext, count: number, withWriting: boolean): Exercise[] {
  const kinds: ((w: VocabEntry) => Exercise | null)[] = [
    (w) => reverseChoice(w, ctx),
    (w) => typeMeaning(w, ctx),
    (w) => listenChoice(w, ctx),
    (w) => pinyinChoice(w, ctx),
    (w) => pick([...curatedFor(w, ctx), listenMeaning(w, ctx)], ctx.random),
    (w) => meaningChoice(w, ctx, false),
    (w) => typePinyin(w),
    (w) => (withWriting ? write(w, "graded") : listenMeaning(w, ctx)),
  ];
  const pool = shuffle(words, ctx.random);
  const out: Exercise[] = [];
  for (let i = 0; out.length < count && i < count * 3 && pool.length; i++) {
    const exercise = kinds[i % kinds.length](pool[i % pool.length]);
    if (exercise) out.push(exercise);
  }
  return shuffle(out, ctx.random);
}

/** Builds a finite session. (Infinite mode uses nextInfinite instead.) */
export function buildSession(params: SessionParams, words: VocabEntry[], ctx: GenContext): Exercise[] {
  if (words.length === 0 || (ctx.silent && isNoisyMode(params.mode))) return [];
  return assembleSession(params, words, ctx).map((exercise) => silenced(exercise, ctx));
}

function assembleSession(params: SessionParams, words: VocabEntry[], ctx: GenContext): Exercise[] {
  const r = ctx.random;
  const length = params.count ?? ctx.sessionLength;
  switch (params.mode) {
    case "leccion":
      return lessonSession(words, ctx);
    case "repaso":
      return reviewSession(words, ctx);
    case "examen":
      return examSession(words, ctx, params.count ?? 20, !!params.withWriting);
    case "escritura": {
      const style = params.style ?? "mixto";
      // Free drawing isn't graded, so it never changes a word's strength: without shuffling, every session would repeat the same words.
      const pool = style === "libre" ? shuffle(words, r) : weakestFirst(words, ctx, "writing");
      const chosen = pool.slice(0, style === "mixto" ? Math.ceil(length / 2) : length);
      return chosen.flatMap((w) =>
        style === "guiado"
          ? [write(w, "guided")]
          : style === "libre"
            ? [write(w, "free")]
            : [write(w, "guided"), write(w, "free")],
      );
    }
    case "tarjetas": {
      const fronts = cardFronts(ctx.silent);
      // A face that can't be used now (audio in silent mode) becomes the mix.
      const fixed = params.front && fronts.includes(params.front) ? params.front : undefined;
      return weakestFirst(words, ctx)
        .slice(0, params.count ?? 20)
        .map((w) => flashcard(w, fixed ?? pick(fronts, r)));
    }
    case "escucha":
      return weakestFirst(words, ctx, "listening")
        .slice(0, length)
        .map((w) => drillFor(w, "listening", ctx));
    case "pronunciacion":
      return shuffle(words, r)
        .slice(0, length)
        .map((w) => {
          const examples = examplesOf(w, ctx);
          return examples.length && r() < 0.35 ? speakSentence(w, pick(examples, r)) : speakWord(w);
        });
    case "tonos": {
      const drills = weakestFirst(words, ctx, "pinyin")
        .slice(0, length)
        .map((w, i) => (i % 3 === 2 ? typePinyin(w) : pinyinChoice(w, ctx)));
      const match = matchPairs(shuffle(words, r), ctx, "pinyin");
      return match ? [match, ...drills] : drills;
    }
    case "frases": {
      const list = shuffle(
        words.flatMap((w) => curatedFor(w, ctx)),
        r,
      ).slice(0, length);
      const dict = ctx.silent
        ? []
        : words.flatMap((w) =>
            examplesOf(w, ctx)
              .slice(0, 1)
              .map((s) => dictation(w, s, ctx)),
          );
      return shuffle([...list, ...sample(dict, Math.max(2, Math.floor(length / 4)), r)], r).slice(0, length);
    }
    case "infinito":
      return [nextInfinite(words, ctx)];
  }
}

/** One more exercise for infinite mode: weak words are picked more often. */
export function nextInfinite(words: VocabEntry[], ctx: GenContext): Exercise {
  const r = ctx.random;
  const weights = words.map((w) => 1.2 - wordMastery(ctx.progress, w.id));
  let roll = r() * weights.reduce((a, b) => a + b, 0);
  let word = words[0];
  for (let i = 0; i < words.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      word = words[i];
      break;
    }
  }
  if (r() < 0.1) {
    const match = matchPairs(sample(words, 6, r), ctx);
    if (match) return match;
  }
  const skill = pick<Skill>(["meaning", "meaning", "listening", "pinyin", "sentences"], r);
  const exercise = drillFor(word, skill, ctx);
  return silenced(
    exercise.type === "write" || exercise.type === "speak" ? meaningChoice(word, ctx) : exercise,
    ctx,
  );
}

/** Prompt helper for components: the Chinese text a prompt can read aloud. */
export function promptSpeech(prompt: Prompt): string | null {
  switch (prompt.kind) {
    case "word":
      return prompt.word.hanzi;
    case "audio":
      return prompt.speak;
    case "sentence":
      return prompt.sentence.zh.join("");
    default:
      return null;
  }
}
