"use client";
import { CloudUpload, Download, ExternalLink, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, cn, PageHeader, SectionTitle, Segmented, Skeleton, Toggle } from "@/components/ui";
import { useExercises } from "@/lib/data/remote";
import { LESSONS, VOCAB, VOCAB_ISSUES } from "@/lib/data/vocab";
import { mergeProgress, reviveProgress } from "@/lib/progress/model";
import { progressStore, replaceProgress, resetProgress, syncNow, useSyncStatus } from "@/lib/progress/store";
import { SyncError, testConnection } from "@/lib/progress/sync";
import { updateSettings, useSettings, type SyncConfig } from "@/lib/settings";
import { chineseVoices, onVoicesReady, speak } from "@/lib/speech";
import { useHydrated } from "@/lib/store";

const DEFAULT_SYNC: SyncConfig = { owner: "Pablo-Caballero-Maria", repo: "sinophile", branch: "main", path: "data/progress.json", token: "", auto: true };

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

function SyncSection() {
  const settings = useSettings();
  const status = useSyncStatus();
  const [form, setForm] = useState<SyncConfig>(settings.sync ?? DEFAULT_SYNC);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const field = (key: keyof SyncConfig, label: string, type = "text") => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        type={type}
        value={String(form[key] ?? "")}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="h-11 rounded-xl border-2 border-line bg-bg px-3 font-normal outline-none focus:border-sky"
      />
    </label>
  );
  const save = async () => {
    setMessage(null);
    try {
      const name = await testConnection(form);
      updateSettings({ sync: form });
      const error = await syncNow();
      setMessage(error ? { ok: false, text: error } : { ok: true, text: `Conectado a ${name} y sincronizado.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SyncError ? e.message : "No se pudo conectar con GitHub." });
    }
  };
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Guarda tu progreso en <code>data/progress.json</code> de tu repositorio para tenerlo en todos tus dispositivos. Necesitas un token de GitHub
        <i> fine-grained</i> con acceso solo a este repositorio y permiso <b>Contents: Read and write</b>. El token solo se guarda en este dispositivo.
      </p>
      <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-sky underline">
        Crear token en GitHub <ExternalLink size={14} />
      </a>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("owner", "Usuario")}
        {field("repo", "Repositorio")}
        {field("branch", "Rama")}
        {field("path", "Archivo")}
      </div>
      {field("token", "Token", "password")}
      <Toggle checked={form.auto} onChange={(auto) => setForm((f) => ({ ...f, auto }))} label="Sincronizar automáticamente" description="Al abrir la app y al terminar cada sesión." />
      <div className="flex flex-wrap gap-2">
        <Button variant="sky" onClick={() => void save()} disabled={!form.token || status.state === "syncing"}>
          <CloudUpload size={18} /> Guardar y sincronizar
        </Button>
        {settings.sync && (
          <>
            <Button variant="secondary" onClick={() => void syncNow().then((e) => setMessage(e ? { ok: false, text: e } : { ok: true, text: "Sincronizado." }))} disabled={status.state === "syncing"}>
              <RefreshCw size={18} className={status.state === "syncing" ? "animate-spin" : undefined} /> Sincronizar ahora
            </Button>
            <Button variant="ghost" onClick={() => (updateSettings({ sync: null }), setForm(DEFAULT_SYNC), setMessage({ ok: true, text: "Sincronización desactivada y token borrado." }))}>
              Desconectar
            </Button>
          </>
        )}
      </div>
      {message && <p className={cn("text-sm font-semibold", message.ok ? "text-ok" : "text-bad")}>{message.text}</p>}
      {settings.sync?.lastSync && <p className="text-xs text-muted">Última sincronización: {new Date(settings.sync.lastSync).toLocaleString("es-ES")}</p>}
    </Card>
  );
}

function BackupSection() {
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
      replaceProgress(mergeProgress(progressStore.get(), incoming));
      setMessage("Progreso importado y combinado con el actual.");
    } catch {
      setMessage("Ese archivo no es un progress.json válido.");
    }
  };
  return (
    <Card className="flex flex-col gap-3">
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
          <p className="text-sm font-semibold text-bad">¿Seguro? Se borrará tu progreso en este dispositivo (y en GitHub si la sincronización está activa). No se puede deshacer.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="bad" size="sm" onClick={() => void resetProgress().then((e) => (setConfirmReset(false), setMessage(e ?? "Progreso borrado.")))}>
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
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <p>
        <b>{VOCAB.length}</b> palabras en <b>{LESSONS.length}</b> lecciones ·{" "}
        {exercises.loading ? "…" : <><b>{Object.keys(exercises.data?.file.words ?? {}).length}</b> palabras con ejercicios propios</>}
      </p>
      {exercises.loading ? (
        <Skeleton className="h-10" />
      ) : issues.length === 0 ? (
        <p className="font-semibold text-ok">✓ vocab.json y exercises.json están correctos.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {issues.map((issue, i) => (
            <li key={i} className={cn(issue.level === "error" ? "text-bad" : issue.level === "warning" ? "text-gold-strong" : "text-muted")}>
              {issue.level === "error" ? "❌" : issue.level === "warning" ? "⚠️" : "ℹ️"} {issue.message}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const hydrated = useHydrated();
  const settings = useSettings();
  if (!hydrated) return <Skeleton className="h-[80vh] rounded-3xl" />;
  return (
    <div className="animate-fade-in">
      <PageHeader title="Ajustes" />

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

      <SectionTitle>Sincronización con GitHub</SectionTitle>
      <SyncSection />

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
