"use client";
/** /palabra?id=<vocab id>  or  /palabra?h=<hanzi>  — word details, strokes, examples, progress. */
import { Copy, Languages, Mic, PenLine } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HanziQuiz, Hanzi, Pinyin, SentenceView, SpeakButton, StrokeOrder, useStrokeData, wordHref } from "@/components/hanzi";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, ProgressBar, SectionTitle, Skeleton } from "@/components/ui";
import { suggestId, vocabLine } from "@/lib/data/format";
import { useExercises } from "@/lib/data/remote";
import { LESSON_BY_ID, VOCAB, VOCAB_BY_ID, vocabByHanzi } from "@/lib/data/vocab";
import { lookup } from "@/lib/dictionary";
import { itemOf } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { useReady } from "@/lib/account/client";
import { MAX_BOX } from "@/lib/srs";
import { formatDay, hanChars } from "@/lib/text";
import { translate } from "@/lib/translate";
import { SKILLS, type Sentence } from "@/lib/types";
import { useCedict } from "@/lib/use-cedict";

function CharacterCard({ char, definition }: { char: string; definition?: string }) {
  const { data } = useStrokeData(char);
  const [tracing, setTracing] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const inVocab = vocabByHanzi(char)[0];
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-3">
      {tracing ? (
        <HanziQuiz key={done ?? "quiz"} char={char} size={180} onComplete={(m) => setDone(m)} />
      ) : (
        <StrokeOrder char={char} size={140} />
      )}
      <Link href={wordHref(char, inVocab?.id)} className="text-center">
        <Hanzi text={char} className="text-xl" />
      </Link>
      <span className="text-xs text-muted">{data ? `${data.strokes.length} trazos` : "…"}</span>
      {definition && <span className="line-clamp-2 max-w-[11rem] text-center text-xs text-muted">{definition}</span>}
      {done !== null && tracing && <span className="text-xs font-bold text-ok">{done === 0 ? "¡Perfecto!" : `${done} error(es)`}</span>}
      <Button size="sm" variant="secondary" onClick={() => (setTracing((t) => !t), setDone(null))}>
        <PenLine size={16} /> {tracing ? "Ver animación" : "Trazar"}
      </Button>
    </div>
  );
}

function WordView() {
  const sp = useSearchParams();
  const ready = useReady();
  const progress = useProgress();
  const exercises = useExercises();
  const id = sp.get("id");
  const word = id ? VOCAB_BY_ID.get(id) : vocabByHanzi(sp.get("h") ?? "")[0];
  const hanzi = word?.hanzi ?? sp.get("h") ?? "";
  const cedict = useCedict(!!hanzi);
  const [spanish, setSpanish] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const definitions = cedict.items ? lookup(cedict.items, hanzi) : [];
  const chars = [...new Set(hanChars(hanzi))];
  const set = word ? exercises.data?.file.words[word.id] : undefined;

  // Example sentences: the word's own + any other example that contains it.
  const allExamples = Object.values(exercises.data?.file.words ?? {}).flatMap((s) => s.examples.filter((e) => e.zh.length));
  const own = (set?.examples ?? []).filter((e) => e.zh.length);
  const seen = new Set(own.map((e) => e.zh.join("")));
  const others = allExamples.filter((e) => e.zh.includes(hanzi) && !seen.has(e.zh.join("")) && seen.add(e.zh.join("")));
  const examples: Sentence[] = [...own, ...others].slice(0, 8);

  const related = VOCAB.filter((w) => w.hanzi !== hanzi && hanChars(w.hanzi).some((c) => chars.includes(c)));

  if (!hanzi) return <EmptyState icon="🔍" title="Palabra no encontrada" />;
  const pinyin = word?.pinyin ?? definitions[0]?.pinyin ?? "";
  const lesson = word ? LESSON_BY_ID.get(word.lesson) : undefined;

  return (
    <div className="animate-fade-in">
      <PageHeader back={lesson ? `/leccion?id=${lesson.id}` : "/diccionario"} title={<span className="sr-only">{hanzi}</span>} />
      <Card className="flex flex-col items-center gap-2 text-center">
        <Hanzi text={hanzi} pinyin={pinyin} className="text-7xl sm:text-8xl" />
        {pinyin ? <Pinyin text={pinyin} className="text-2xl font-semibold" /> : <Skeleton className="h-7 w-32" />}
        {word ? (
          <p className="text-2xl font-bold">{word.es}</p>
        ) : definitions.length ? (
          <p className="text-lg">
            {definitions[0].meaning} <Badge>inglés</Badge>
          </p>
        ) : cedict.loading ? (
          <Skeleton className="h-6 w-48" />
        ) : null}
        {!word && (
          <div className="flex flex-col items-center gap-2">
            {spanish ? (
              <p className="text-xl font-bold">{spanish}</p>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => void translate(hanzi, "zh", "es").then(setSpanish, (e: Error) => setSpanish(e.message))}>
                <Languages size={16} /> Traducir al español
              </Button>
            )}
          </div>
        )}
        <SpeakButton text={hanzi} className="mt-2" />
        {lesson && (
          <Link href={`/leccion?id=${lesson.id}`}>
            <Badge className="bg-sky-soft text-sky">
              Lección {lesson.number} · {formatDay(lesson.id)}
            </Badge>
          </Link>
        )}
      </Card>

      {word ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ButtonLink href={`/sesion?modo=escritura&estilo=mixto&id=${word.id}`} variant="ok">
            <PenLine size={20} /> Escribir
          </ButtonLink>
          <ButtonLink href={`/sesion?modo=pronunciacion&id=${word.id}`} variant="secondary">
            <Mic size={20} className="text-brand" /> Pronunciar
          </ButtonLink>
        </div>
      ) : (
        pinyin && (
          <Button
            variant="secondary"
            full
            className="mt-4"
            onClick={() => {
              const line = vocabLine({ id: suggestId(pinyin), hanzi, pinyin, es: spanish ?? "" });
              void navigator.clipboard.writeText(line + ",");
              setCopied(true);
            }}
          >
            <Copy size={18} /> {copied ? "¡Copiado! Pégalo en data/AAAA-MM-DD/vocab.json" : "Copiar como entrada de vocab.json"}
          </Button>
        )
      )}

      {set?.note && <p className="mt-4 rounded-2xl bg-gold-soft p-4">💡 {set.note}</p>}

      <SectionTitle>Caracteres y orden de trazos</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {chars.map((c) => (
          <CharacterCard key={c} char={c} definition={cedict.items ? lookup(cedict.items, c)[0]?.meaning : undefined} />
        ))}
      </div>

      <SectionTitle>Frases de ejemplo</SectionTitle>
      {exercises.loading ? (
        <Skeleton className="h-24 rounded-3xl" />
      ) : examples.length ? (
        <div className="flex flex-col gap-3">
          {examples.map((s, i) => (
            <Card key={i}>
              <SentenceView sentence={s} highlight={hanzi} size="text-xl" />
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Todavía no hay frases con esta palabra.</p>
      )}

      {word && (
        <>
          <SectionTitle>Tu dominio</SectionTitle>
          <Card className="flex flex-col gap-3">
            {ready ? (
              SKILLS.map((skill) => {
                const item = itemOf(progress, word.id, skill.id);
                return (
                  <div key={skill.id} className="flex items-center gap-3">
                    <span lang="zh-CN" className="w-6 text-center font-hanzi text-lg text-muted">
                      {skill.icon}
                    </span>
                    <span className="w-32 text-sm font-semibold">{skill.label}</span>
                    <ProgressBar value={(item?.b ?? 0) / MAX_BOX} className="flex-1" barClassName="bg-gold" />
                    <span className="w-24 text-right text-xs text-muted">{item ? `repaso ${formatDay(item.d, false)}` : "sin practicar"}</span>
                  </div>
                );
              })
            ) : (
              <Skeleton className="h-40" />
            )}
          </Card>
        </>
      )}

      {related.length > 0 && (
        <>
          <SectionTitle>Palabras relacionadas</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {related.map((w) => (
              <Link key={w.id} href={wordHref(w.hanzi, w.id)} className="rounded-2xl border border-line bg-surface px-3 py-2 hover:bg-surface-2">
                <Hanzi text={w.hanzi} pinyin={w.pinyin} className="text-xl" /> <span className="text-sm text-muted">{w.es}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {definitions.length > 0 && (
        <>
          <SectionTitle action={<Badge>CC-CEDICT</Badge>}>Diccionario general (inglés)</SectionTitle>
          <ul className="flex flex-col gap-2">
            {definitions.map((d, i) => (
              <li key={i} className="rounded-2xl border border-line bg-surface p-3">
                <Pinyin text={d.pinyin} className="font-semibold" /> <span className="text-muted">— {d.meaning}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function WordPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
      <WordView />
    </Suspense>
  );
}
