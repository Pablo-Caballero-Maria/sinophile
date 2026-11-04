"use client";
import { ChevronRight, Download, Trash2, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, cn, PageHeader, SectionTitle, Segmented, Skeleton, Toggle } from "@/components/ui";
import { importProgress, resetProgress, useAccount, useReady } from "@/lib/account/client";
import { useExercises } from "@/lib/data/remote";
import { LESSONS, VOCAB, VOCAB_ISSUES } from "@/lib/data/vocab";
import { isEmptyProgress, reviveProgress } from "@/lib/progress/model";
import { progressStore } from "@/lib/progress/store";
import { updateSettings, useSettings } from "@/lib/settings/store";
import { chineseVoices, onVoicesReady, speak } from "@/lib/speech";
import { formatDay } from "@/lib/text";
import { ClaudePackButton } from "@/components/claude-pack-button";

function VoicePicker() {
  const settings = useSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => onVoicesReady(() => setVoices(chineseVoices())), []);
  return (
    <div className="flex flex-col gap-2 py-2">
      <label className="font-medium" htmlFor="voice">
        Voz china
      </label>
      {voices.length ? (
        <select
          id="voice"
          value={settings.voiceURI ?? ""}
          onChange={(e) => updateSettings({ voiceURI: e.target.value || null })}
          className="h-11 rounded-xl border-2 border-line bg-surface px-3"
        >
          <option value="">Automática ({voices[0]?.name})</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-bad">No encuentro voces en chino en este dispositivo. En iPad: Ajustes → Accesibilidad → Contenido leído → Voces → Chino.</p>
      )}
      <label className="mt-2 font-medium" htmlFor="rate">
        Velocidad: {settings.ttsRate.toFixed(2)}×
      </label>
      <input id="rate" type="range" min={0.5} max={1.2} step={0.05} value={settings.ttsRate} onChange={(e) => updateSettings({ ttsRate: Number(e.target.value) })} />
      <Button variant="secondary" size="sm" className="self-start" onClick={() => void speak("你好，我是你的中文老师。")}>
        Probar voz
      </Button>
    </div>
  );
}

function AccountSection() {
  const account = useAccount();
  const user = account.status === "user";
  return (
    <Link href="/cuenta" className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 hover:bg-surface-2">
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-black uppercase text-white", user ? "bg-sky" : "bg-line")}>
        {user ? account.username?.[0] : <UserRound size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate">{user ? account.username : "Modo invitado"}</b>
        <span className="text-sm text-muted">
          {user ? "Tu progreso y estos ajustes se guardan en tu cuenta." : "No se guarda nada. Entra o crea una cuenta para conservar tu progreso."}
        </span>
      </span>
      <ChevronRight size={18} className="text-muted" />
    </Link>
  );
}

function BackupSection() {
  const account = useAccount();
  const file = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const exportFile = () => {
    const blob = new Blob([JSON.stringify(progressStore.get(), null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "progress.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = async (f: File) => {
    try {
      const incoming = reviveProgress(JSON.parse(await f.text()));
      if (isEmptyProgress(incoming)) return setMessage("Ese archivo no contiene progreso.");
      importProgress(incoming);
      setMessage("Progreso importado y combinado con el actual.");
    } catch {
      setMessage("Ese archivo no es un progress.json válido.");
    }
  };
  const reset = async () => {
    try {
      await resetProgress();
      setMessage("Progreso borrado.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo borrar el progreso.");
    }
    setConfirmReset(false);
  };
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-muted">Descarga tu progreso como archivo o combina en él uno descargado antes.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportFile}>
          <Download size={18} /> Exportar progress.json
        </Button>
        <Button variant="secondary" onClick={() => file.current?.click()}>
          <Upload size={18} /> Importar
        </Button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
      </div>
      {!confirmReset ? (
        <Button variant="ghost" className="self-start text-bad" onClick={() => setConfirmReset(true)}>
          <Trash2 size={18} /> Borrar todo mi progreso
        </Button>
      ) : (
        <div className="rounded-2xl bg-bad-soft p-3">
          <p className="text-sm font-semibold text-bad">
            ¿Seguro? Se borrará tu progreso{account.status === "user" ? " de tu cuenta en todos tus dispositivos" : ""}. No se puede deshacer.
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="bad" size="sm" onClick={() => void reset()}>
              Sí, borrar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {message && <p className="text-sm font-semibold text-muted">{message}</p>}
    </Card>
  );
}

function DataStatus() {
  const exercises = useExercises();
  const issues = [...VOCAB_ISSUES, ...(exercises.data?.issues ?? [])];
  const missing = new Set(exercises.data?.missing ?? []);
  return (
    <Card className="flex flex-col gap-3 text-sm">
      <p>
        <b>{VOCAB.length}</b> palabras en <b>{LESSONS.length}</b> lecciones (una carpeta <code>data/AAAA-MM-DD/</code> por clase).
      </p>
      <ul className="flex flex-col gap-2">
        {LESSONS.map((lesson) => {
          const without = lesson.words.filter((w) => missing.has(w.id)).length;
          return (
            <li key={lesson.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-surface-2 px-3 py-2">
              <span className="font-bold">
                L{lesson.number} · {formatDay(lesson.id)}
              </span>
              <span className="flex-1 text-muted">
                {lesson.words.length} palabras ·{" "}
                {exercises.loading ? "…" : without === 0 ? "todas con ejercicios propios" : `${without} sin ejercicios propios`}
              </span>
              {!exercises.loading && without > 0 && <ClaudePackButton lesson={lesson} />}
            </li>
          );
        })}
      </ul>
      {exercises.loading ? (
        <Skeleton className="h-10" />
      ) : issues.length === 0 ? (
        <p className="font-semibold text-ok">✓ Todos los vocab.json y exercises.json están correctos.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {issues.map((issue, i) => (
            <li key={i} className={cn(issue.level === "error" ? "text-bad" : issue.level === "warning" ? "text-gold-strong" : "text-muted")}>
              {issue.level === "error" ? "❌" : issue.level === "warning" ? "⚠️" : "ℹ️"} {issue.message}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted">
        «Paquete para Claude» descarga un archivo con las instrucciones y el vocabulario necesario: súbelo a claude.ai y pídele el exercises.json de esa clase.
      </p>
    </Card>
  );
}

export default function SettingsPage() {
  const ready = useReady();
  const settings = useSettings();
  if (!ready) return <Skeleton className="h-[80vh] rounded-3xl" />;
  return (
    <div className="animate-fade-in">
      <PageHeader title="Ajustes" />
      <AccountSection />

      <SectionTitle>Meta diaria</SectionTitle>
      <Segmented
        value={settings.dailyGoal}
        onChange={(dailyGoal) => updateSettings({ dailyGoal })}
        options={[
          { value: 20, label: "Suave · 20" },
          { value: 50, label: "Normal · 50" },
          { value: 100, label: "Seria · 100" },
          { value: 150, label: "Intensa · 150" },
        ]}
      />

      <SectionTitle>Apariencia</SectionTitle>
      <Card>
        <Segmented
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: "auto", label: "Automático" },
            { value: "light", label: "Claro" },
            { value: "dark", label: "Oscuro" },
          ]}
        />
        <Toggle checked={settings.toneColors} onChange={(toneColors) => updateSettings({ toneColors })} label="Colorear por tonos" description="1.º rojo · 2.º naranja · 3.º verde · 4.º azul · neutro gris" />
        <Toggle checked={settings.showPinyin} onChange={(showPinyin) => updateSettings({ showPinyin })} label="Mostrar pinyin en los ejercicios" />
      </Card>

      <SectionTitle>Audio y voz</SectionTitle>
      <Card>
        <Toggle checked={settings.sound} onChange={(sound) => updateSettings({ sound })} label="Efectos de sonido" />
        <Toggle checked={settings.autoplayAudio} onChange={(autoplayAudio) => updateSettings({ autoplayAudio })} label="Reproducir audio automáticamente" />
        <VoicePicker />
      </Card>

      <SectionTitle>Práctica</SectionTitle>
      <Card>
        <p className="py-2 font-medium">Ejercicios por sesión</p>
        <Segmented value={settings.sessionLength} onChange={(sessionLength) => updateSettings({ sessionLength })} options={[10, 15, 20, 25].map((n) => ({ value: n, label: `${n}` }))} />
        <Toggle checked={settings.speakingInLessons} onChange={(speakingInLessons) => updateSettings({ speakingInLessons })} label="Pronunciación en las lecciones" description="Incluye un ejercicio de micrófono en cada lección." />
        <Toggle checked={settings.penOnly} onChange={(penOnly) => updateSettings({ penOnly })} label="Solo lápiz al dibujar" description="Si usas Apple Pencil, se ignoran los toques con la mano." />
      </Card>

      <SectionTitle>Copia de seguridad</SectionTitle>
      <BackupSection />

      <SectionTitle>
        <span id="datos" className="scroll-mt-20">
          Estado de los datos
        </span>
      </SectionTitle>
      <DataStatus />

      <SectionTitle>Créditos</SectionTitle>
      <Card className="text-sm text-muted">
        <p>
          Diccionario: <a className="underline" href="https://cc-cedict.org/" target="_blank" rel="noreferrer">CC-CEDICT</a> (CC BY-SA 4.0). Trazos: Make Me a Hanzi / hanzi-writer-data (Arphic Public License) y{" "}
          <a className="underline" href="https://hanziwriter.org" target="_blank" rel="noreferrer">Hanzi Writer</a>. Pinyin: pinyin-pro. Traducción automática: Google Translate / MyMemory.
        </p>
        <p className="mt-2">
          <Badge>sinophile</Badge> · hecho con Next.js
        </p>
      </Card>
    </div>
  );
}
