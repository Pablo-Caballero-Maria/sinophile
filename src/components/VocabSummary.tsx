"use client";
/**
 * Home-page card: how many words you know and how they compare with HSK 2 (HSK 3.0: its 500
 * words, the 300 of HSK 1 included).
 * A word counts once it has been practised, so each account (and each guest
 * visit) has its own count.
 */
import { BookOpen, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useAccount } from "@/lib/account/client";
import { VOCAB } from "@/lib/data/vocab";
import { HOMOGRAPHS, HSK, hskSummary, percent, posLabel, type HskSummary, type HskWord } from "@/lib/hsk";
import { isSeen } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { Hanzi } from "./Hanzi";
import { Card, cn, Ring, Segmented, Skeleton } from "./UI";

type Filter = "todas" | "conocidas" | "pendientes";

/** A percentage ring next to a big number and its caption. */
function Stat({
  percent: pct,
  color,
  value,
  caption,
}: {
  percent: number;
  color: string;
  value: ReactNode;
  caption: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
      <Ring value={pct / 100} size={60} stroke={6} color={color}>
        <span className="text-sm font-extrabold tabular-nums">{pct}%</span>
      </Ring>
      <div className="min-w-0 leading-tight">
        <p className="text-2xl font-black tabular-nums">{value}</p>
        <p className="text-sm text-muted">{caption}</p>
      </div>
    </div>
  );
}

const filterLabel = (count: number, text: string) => (
  <span className="leading-tight">
    <span className="block font-extrabold tabular-nums">{count}</span>
    <span className="block text-xs">{text}</span>
  </span>
);

/** How many words of the list you know (点 the classifier and 点 the verb count as two). */
const knownCount = (summary: HskSummary) => HSK.filter((w) => summary.known.has(w.hanzi)).length;

function HskWordLink({ word: w, summary }: { word: HskWord; summary: HskSummary }) {
  const via = summary.known.get(w.hanzi);
  const inside = via && via.hanzi !== w.hanzi;
  return (
    <Link
      href={
        via && !inside
          ? `/palabra?id=${encodeURIComponent(via.id)}`
          : `/palabra?h=${encodeURIComponent(w.hanzi)}`
      }
      title={inside ? `La conoces por ${via.hanzi}` : undefined}
      className={cn(
        "flex min-w-14 flex-col items-center rounded-xl border px-2 py-1 leading-tight transition-colors",
        via
          ? "border-ok/40 bg-ok-soft text-muted hover:border-ok"
          : "border-line bg-surface text-muted hover:bg-surface-2",
      )}
    >
      <Hanzi text={w.hanzi} className={cn("text-lg", via && "font-bold text-ok")} />
      <span className="text-[0.7rem]">{w.pinyin}</span>
      {/* 点, 花, 过 are two words each: their part of speech tells which. */}
      {HOMOGRAPHS.has(w.hanzi) && <span className="text-[0.65rem] italic">{posLabel(w.pos)}</span>}
      {inside && (
        <span lang="zh-CN" className="font-hanzi text-[0.65rem]">
          en {via.hanzi}
        </span>
      )}
    </Link>
  );
}

function HskList({ summary }: { summary: HskSummary }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const known = knownCount(summary);
  const shown = (w: HskWord) =>
    filter === "todas" ? true : summary.known.has(w.hanzi) === (filter === "conocidas");
  return (
    <div className="mt-3">
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "todas", label: filterLabel(HSK.length, "todas") },
          { value: "conocidas", label: filterLabel(known, "conocidas") },
          { value: "pendientes", label: filterLabel(HSK.length - known, "por aprender") },
        ]}
      />
      {[1, 2].map((level) => {
        const words = HSK.filter((w) => w.level === level && shown(w));
        return (
          <section key={level} aria-label={`Nivel ${level}`} className="mt-3">
            <h3 className="text-xs font-extrabold tracking-wide text-muted uppercase">
              {level === 1 ? "Nivel 1 · 300 palabras" : "Nivel 2 · 200 palabras más"}
            </h3>
            {words.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {words.map((w) => (
                  <li key={`${w.hanzi}-${w.pinyin}-${w.pos}`}>
                    <HskWordLink word={w} summary={summary} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Ninguna.</p>
            )}
          </section>
        );
      })}
      <p className="mt-3 text-xs text-muted">
        La lista es la del HSK 2 del HSK 3.0 (temario de 2025): las 300 palabras del nivel 1 y las 200 del
        nivel 2. Una palabra cuenta como conocida si la has practicado o aparece dentro de otra que conoces
        (书 en 本书, 月 en 一月); 杯 cuenta por 杯子. Las palabras formadas solo por palabras de la lista
        (星期一, 本书) también cuentan como tuyas del HSK 2.
      </p>
    </div>
  );
}

export function VocabSummary() {
  const { status } = useAccount();
  const progress = useProgress();
  const words = useMemo(() => VOCAB.filter((w) => isSeen(progress, w.id)), [progress]);
  const summary = useMemo(() => hskSummary(words), [words]);

  if (status === "loading") return <Skeleton className="h-56 rounded-3xl" />;

  const total = words.length;
  const known = knownCount(summary);
  const own = summary.hskWords.length;
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <BookOpen size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-extrabold">
            Conoces <span className="text-2xl text-brand tabular-nums">{total}</span>{" "}
            {total === 1 ? "palabra" : "palabras"}
          </p>
          {total === 0 && (
            <p className="text-sm text-muted">
              Cuando practiques una lección, aquí irán apareciendo sus palabras.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Stat
          percent={percent(own, total)}
          color="var(--sky)"
          value={own}
          caption={<>de ellas son del HSK&nbsp;2</>}
        />
        <Stat
          percent={percent(known, HSK.length)}
          color="var(--ok)"
          value={
            <>
              {known}
              <span className="text-base font-bold text-muted">/{HSK.length}</span>
            </>
          }
          caption={<>palabras del HSK&nbsp;2 que conoces</>}
        />
      </div>
      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-1 py-2 text-sm font-bold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          Ver las palabras del HSK 2
          <ChevronDown size={18} className="transition-transform group-open:rotate-180" />
        </summary>
        <HskList summary={summary} />
      </details>
    </Card>
  );
}
