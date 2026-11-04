"use client";
import { ArrowLeftRight, Check, ChevronRight, Copy, Languages, Mic, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { Hanzi, Pinyin, SpeakButton, wordHref } from "@/components/hanzi";
import { Badge, Button, Card, cn, EmptyState, PageHeader, SectionTitle, Segmented, Skeleton } from "@/components/ui";
import { LESSONS, VOCAB } from "@/lib/data/vocab";
import { indexVocab, search, segmentText } from "@/lib/dictionary";
import { suggestId, vocabLine } from "@/lib/data/format";
import { listen, recognitionSupported } from "@/lib/speech";
import { formatDay, hasHan } from "@/lib/text";
import { translate, type Lang } from "@/lib/translate";
import type { DictEntry } from "@/lib/types";
import { useCedict } from "@/lib/use-cedict";

const vocabIndex = indexVocab(VOCAB);
const vocabHanzi = new Set(VOCAB.map((w) => w.hanzi));

function ResultRow({ entry }: { entry: DictEntry }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <SpeakButton text={entry.hanzi} size="sm" slow={false} />
      <Link href={wordHref(entry.hanzi, entry.id)} className="flex min-w-0 flex-1 items-center gap-3">
        <Hanzi text={entry.hanzi} pinyin={entry.pinyin} className="shrink-0 text-2xl" />
        <span className="min-w-0 flex-1">
          <Pinyin text={entry.pinyin} className="block text-sm font-semibold" />
          <span className="line-clamp-2 text-sm text-muted">{entry.meaning}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function SearchTab({ initial }: { initial: string }) {
  const [query, setQuery] = useState(initial);
  const q = useDeferredValue(query.trim());
  const cedict = useCedict(q.length > 0);
  const mine = useMemo(() => search(vocabIndex, q, 30), [q]);
  const general = useMemo(() => (cedict.items && q ? search(cedict.items, q, 40).filter((e) => !vocabHanzi.has(e.hanzi)) : []), [cedict.items, q]);

  return (
    <>
      <label className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 focus-within:border-sky">
        <Search size={20} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hanzi, pinyin (ni3hao3), español o inglés…"
          className="h-14 w-full bg-transparent text-lg outline-none"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          type="search"
        />
      </label>

      {!q ? (
        <>
          <SectionTitle>Tu vocabulario</SectionTitle>
          {LESSONS.map((lesson) => (
            <div key={lesson.id} className="mb-4">
              <p className="mb-2 text-sm font-bold text-muted">
                Lección {lesson.number} · {formatDay(lesson.id)}
              </p>
              <ul className="flex flex-col gap-2">
                {lesson.words.map((w) => (
                  <ResultRow key={w.id} entry={{ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.es, source: "vocab", id: w.id }} />
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : (
        <>
          <SectionTitle action={<Badge>{mine.length}</Badge>}>En tu vocabulario</SectionTitle>
          {mine.length ? (
            <ul className="flex flex-col gap-2">
              {mine.map((e) => (
                <ResultRow key={e.id} entry={e} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Ninguna de tus palabras coincide.</p>
          )}
          <SectionTitle action={<Badge>CC-CEDICT · inglés</Badge>}>Diccionario general</SectionTitle>
          {cedict.error ? (
            <p className="text-sm text-bad">{cedict.error}</p>
          ) : !cedict.items ? (
            <SkeletonRows />
          ) : general.length ? (
            <ul className="flex flex-col gap-2">
              {general.map((e, i) => (
                <ResultRow key={`${e.hanzi}-${i}`} entry={e} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin resultados. Prueba con el traductor ↑</p>
          )}
        </>
      )}
    </>
  );
}

/** Suggests a vocab.json line for a translated word, ready to paste in GitHub. */
const vocabSnippet = (hanzi: string, pinyin: string, es: string): string => vocabLine({ id: suggestId(pinyin), hanzi, pinyin, es: es.trim() });

function TranslateTab() {
  const [direction, setDirection] = useState<"es-zh" | "zh-es">("es-zh");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ output: string; zh: string; pinyin: string; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const cedict = useCedict(!!result);
  const [from, to] = direction.split("-") as [Lang, Lang];

  const known = useMemo(() => new Set([...vocabHanzi, ...(cedict.items?.map((i) => i.entry.hanzi) ?? [])]), [cedict.items]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const output = await translate(text, from, to);
      const zh = to === "zh" ? output : text.trim();
      const { pinyin } = await import("pinyin-pro");
      setResult({ output, zh, pinyin: pinyin(zh, { toneType: "symbol" }), source: text.trim() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dictate = async () => {
    setListening(true);
    try {
      const [best] = await listen(from === "zh" ? "zh-CN" : "es-ES").result;
      if (best) setText(best);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setListening(false);
    }
  };

  const tokens = result ? segmentText(result.zh, known).filter(hasHan) : [];
  const singleWord = result && to === "zh" && [...result.zh].length <= 6 && !/[，。！？,.!?]/.test(result.zh);

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-center font-bold">{from === "es" ? "Español" : "Chino"}</span>
          <button type="button" aria-label="Invertir idiomas" onClick={() => setDirection((d) => (d === "es-zh" ? "zh-es" : "es-zh"))} className="rounded-xl p-2 text-sky hover:bg-surface-2">
            <ArrowLeftRight size={20} />
          </button>
          <span className="flex-1 text-center font-bold">{to === "es" ? "Español" : "Chino"}</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          lang={from === "zh" ? "zh-CN" : "es"}
          placeholder={from === "es" ? "Escribe en español…" : "输入中文…"}
          className={cn("w-full resize-none rounded-2xl border-2 border-line bg-bg p-3 text-lg outline-none focus:border-sky", from === "zh" && "font-hanzi")}
        />
        <div className="flex gap-2">
          {recognitionSupported() && (
            <Button variant="secondary" aria-label="Dictar" onClick={() => void dictate()} disabled={listening}>
              <Mic size={20} className={listening ? "animate-pulse text-bad" : undefined} />
            </Button>
          )}
          <Button className="flex-1" onClick={() => void run()} disabled={!text.trim() || busy}>
            <Languages size={20} /> {busy ? "Traduciendo…" : "Traducir"}
          </Button>
        </div>
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      </Card>

      {busy && <Skeleton className="mt-4 h-32 rounded-3xl" />}
      {result && !busy && (
        <Card className="mt-4 flex animate-fade-in flex-col gap-3">
          <div className="flex items-start gap-3">
            <SpeakButton text={result.zh} size="sm" />
            <div className="min-w-0 flex-1">
              {to === "zh" ? (
                <>
                  <Hanzi text={result.zh} pinyin={result.pinyin} className="text-3xl leading-relaxed" />
                  <Pinyin text={result.pinyin} className="block text-muted" />
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold">{result.output}</p>
                  <Pinyin text={result.pinyin} className="block text-sm text-muted" />
                </>
              )}
            </div>
          </div>
          {tokens.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tokens.map((t, i) => (
                <Link key={`${t}-${i}`} href={wordHref(t)} className="flex items-center gap-1 rounded-xl border border-line px-2 py-1 hover:bg-surface-2">
                  <Hanzi text={t} className="text-lg" />
                  {vocabHanzi.has(t) && <Check size={14} className="text-ok" />}
                </Link>
              ))}
            </div>
          )}
          {singleWord && (
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="mb-2 text-sm text-muted">¿Quieres añadirla a tu vocabulario? Copia esta línea en el vocab.json de la clase (data/AAAA-MM-DD/vocab.json):</p>
              <code className="block overflow-x-auto whitespace-nowrap text-xs">{vocabSnippet(result.zh, result.pinyin.replace(/ /g, ""), result.source)}</code>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard.writeText(vocabSnippet(result.zh, result.pinyin.replace(/ /g, ""), result.source) + ",");
                  setCopied(true);
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "¡Copiado!" : "Copiar"}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">Traducción automática: úsala como orientación.</p>
        </Card>
      )}
    </>
  );
}

function DictionaryView() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<"buscar" | "traducir">(sp.get("tab") === "traducir" ? "traducir" : "buscar");
  if (VOCAB.length === 0 && tab === "buscar" && !sp.get("q")) return <EmptyState icon="📖" title="Diccionario vacío" />;
  return (
    <div className="animate-fade-in">
      <PageHeader title="Diccionario" subtitle="Busca en tu vocabulario y en más de 100.000 palabras, o traduce frases." />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "buscar", label: "Buscar" },
          { value: "traducir", label: "Traductor" },
        ]}
      />
      {tab === "buscar" ? <SearchTab initial={sp.get("q") ?? ""} /> : <TranslateTab />}
    </div>
  );
}

export default function DictionaryPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
      <DictionaryView />
    </Suspense>
  );
}
