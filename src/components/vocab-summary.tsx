"use client";
/**
 * Home-page card: how many words you know and how they compare with HSK 1.
 * A word counts once it has been practised, so each account (and each guest
 * visit) has its own count.
 */
import { BookOpen, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useAccount } from "@/lib/account/client";
import { VOCAB } from "@/lib/data/vocab";
import { HSK1, hskSummary, percent, type HskSummary } from "@/lib/hsk";
import { isSeen } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { Hanzi } from "./hanzi";
import { Card, cn, Ring, Segmented, Skeleton } from "./ui";

type Filter = "todas" | "conocidas" | "pendientes";

/** A percentage ring next to a big number and its caption. */
function Stat({ percent: pct, color, value, caption }: { percent: number; color: string; value: ReactNode; caption: ReactNode }) {
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

function HskList({ summary }: { summary: HskSummary }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const known = summary.known.size;
  const words = HSK1.filter((w) => (filter === "todas" ? true : summary.known.has(w.hanzi) === (filter === "conocidas")));
  return (
    <div className="mt-3">
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "todas", label: filterLabel(HSK1.length, "todas") },
          { value: "conocidas", label: filterLabel(known, "conocidas") },
          { value: "pendientes", label: filterLabel(HSK1.length - known, "por aprender") },
        ]}
      />
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {words.map((w) => {
          const via = summary.known.get(w.hanzi);
          const inside = via && via.hanzi !== w.hanzi;
          return (
            <li key={w.hanzi}>
              <Link
                href={via && !inside ? `/palabra?id=${encodeURIComponent(via.id)}` : `/palabra?h=${encodeURIComponent(w.hanzi)}`}
                title={inside ? `La conoces por ${via.hanzi}` : undefined}
                className={cn(
                  "flex min-w-14 flex-col items-center rounded-xl border px-2 py-1 leading-tight transition-colors",
                  via ? "border-ok/40 bg-ok-soft text-muted hover:border-ok" : "border-line bg-surface text-muted hover:bg-surface-2",
                )}
              >
                <Hanzi text={w.hanzi} className={cn("text-lg", via && "font-bold text-ok")} />
                <span className="text-[0.7rem]">{w.pinyin}</span>
                {inside && (
                  <span lang="zh-CN" className="font-hanzi text-[0.65rem]">
                    en {via.hanzi}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Una palabra del HSK 1 cuenta como conocida si la has practicado o aparece dentro de otra que conoces (书 en 本书, 月 en 一月);
        杯 cuenta por 杯子. Las palabras formadas solo por palabras del HSK 1 (星期一, 本书) también cuentan como tuyas del HSK 1.
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
  const known = summary.known.size;
  const own = summary.hskWords.length;
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <BookOpen size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-tight">
            Conoces <span className="text-2xl text-brand tabular-nums">{total}</span> {total === 1 ? "palabra" : "palabras"}
          </p>
          {total === 0 && <p className="text-sm text-muted">Cuando practiques una lección, aquí irán apareciendo sus palabras.</p>}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Stat percent={percent(own, total)} color="var(--sky)" value={own} caption={<>de ellas son del HSK&nbsp;1</>} />
        <Stat
          percent={percent(known, HSK1.length)}
          color="var(--ok)"
          value={
            <>
              {known}
              <span className="text-base font-bold text-muted">/{HSK1.length}</span>
            </>
          }
          caption={<>palabras del HSK&nbsp;1 que conoces</>}
        />
      </div>
      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-1 py-2 text-sm font-bold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          Ver las palabras del HSK 1
          <ChevronDown size={18} className="transition-transform group-open:rotate-180" />
        </summary>
        <HskList summary={summary} />
      </details>
    </Card>
  );
}
