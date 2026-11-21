"use client";
/** /cuenta — sign in / sign up (guests) or account management (signed-in users). */
import { CloudCheck, CloudOff, LoaderCircle, LogOut, RefreshCw, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Card, cn, PageHeader, SectionTitle, Segmented, Skeleton, Toggle } from "@/components/UI";
import {
  deleteAccount,
  reconnect,
  signIn,
  signOut,
  signUp,
  useAccount,
  type AccountState,
} from "@/lib/account/client";
import { credentialsError, PASSWORD_MIN } from "@/lib/account/types";
import { isEmptyProgress, totalXp } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";

const INPUT = "h-12 rounded-xl border-2 border-line bg-bg px-3 font-normal outline-none focus:border-sky";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Algo ha fallado. Inténtalo de nuevo.";

function AuthForm({ account }: { account: AccountState }) {
  const router = useRouter();
  const progress = useProgress();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [adopt, setAdopt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLocal = !isEmptyProgress(progress);
  const register = mode === "register";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = register
      ? (credentialsError(username, password) ??
        (password !== repeat ? "Las contraseñas no coinciden." : null))
      : null;
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await (register ? signUp : signIn)({ username, password }, adopt);
      router.push("/");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <Segmented
        value={mode}
        onChange={(m) => (setMode(m), setError(null))}
        options={[
          { value: "login", label: "Iniciar sesión" },
          { value: "register", label: "Crear cuenta" },
        ]}
      />
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <Field label="Nombre de usuario">
          <input
            className={INPUT}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </Field>
        <Field label={register ? `Contraseña (mínimo ${PASSWORD_MIN} caracteres)` : "Contraseña"}>
          <input
            className={INPUT}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={register ? "new-password" : "current-password"}
            required
          />
        </Field>
        {register && (
          <Field label="Repite la contraseña">
            <input
              className={INPUT}
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
        )}
        {hasLocal && (
          <Toggle
            checked={adopt}
            onChange={setAdopt}
            label="Añadir a la cuenta lo que has practicado"
            description={`${totalXp(progress)} XP conseguidos en esta visita${account.expired ? " (antes de que caducara la sesión)" : " como invitado"}.`}
          />
        )}
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <Button type="submit" size="lg" variant="sky" full disabled={busy}>
          {busy && <LoaderCircle size={20} className="animate-spin" />}
          {register ? "Crear cuenta" : "Entrar"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        {register
          ? "Tu progreso y tus ajustes se guardarán en tu cuenta y los tendrás en todos tus dispositivos."
          : "¿No tienes cuenta? Elige «Crear cuenta». También puedes seguir como invitado: podrás practicar igual, pero tu progreso no se guardará al cerrar la app."}
      </p>
    </Card>
  );
}

function SaveStatusLine({ save }: { save: AccountState["save"] }) {
  if (save === "error")
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-bad">
        <CloudOff size={18} /> No se pudieron guardar los últimos cambios. Se reintentará automáticamente.
      </p>
    );
  if (save === "saving" || save === "pending")
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle size={18} className="animate-spin" /> Guardando…
      </p>
    );
  return (
    <p className="flex items-center gap-2 text-sm text-ok">
      <CloudCheck size={18} /> Todo tu progreso está guardado en tu cuenta.
    </p>
  );
}

function AccountPanel({ account }: { account: AccountState }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.push("/");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-sky text-2xl font-black text-white uppercase">
            {account.username?.[0]}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted">Sesión iniciada como</p>
            <p className="truncate text-xl font-black">{account.username}</p>
          </div>
        </div>
        <SaveStatusLine save={account.save} />
        <Button variant="secondary" onClick={() => void run(signOut)} disabled={busy} className="self-start">
          <LogOut size={18} /> Cerrar sesión
        </Button>
      </Card>

      <SectionTitle>Zona peligrosa</SectionTitle>
      <Card className="flex flex-col gap-3">
        {!confirmDelete ? (
          <Button variant="ghost" className="self-start text-bad" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={18} /> Borrar mi cuenta
          </Button>
        ) : (
          <form
            className="flex flex-col gap-3 rounded-2xl bg-bad-soft p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => deleteAccount(password));
            }}
          >
            <p className="text-sm font-semibold text-bad">
              Se borrarán tu cuenta, tu progreso y tus ajustes. No se puede deshacer. Escribe tu contraseña
              para confirmarlo.
            </p>
            <input
              className={INPUT}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <div className="flex gap-2">
              <Button type="submit" variant="bad" size="sm" disabled={busy || !password}>
                Sí, borrar mi cuenta
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>
      {error && <p className={cn("mt-3 text-sm font-semibold text-bad")}>{error}</p>}
    </>
  );
}

export default function AccountPage() {
  const account = useAccount();
  const [retrying, setRetrying] = useState(false);
  if (account.status === "loading") return <Skeleton className="h-96 rounded-3xl" />;
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tu cuenta"
        subtitle={
          account.status === "user"
            ? undefined
            : "Entra para guardar tu progreso y usarlo en todos tus dispositivos."
        }
      />
      {account.status === "offline" && (
        <Card tone="gold" className="mb-4 flex flex-col gap-2">
          <p className="font-semibold">
            No se puede conectar con el servidor. Puedes practicar como invitado, pero no se guardará nada.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={retrying}
            onClick={() => (setRetrying(true), void reconnect().finally(() => setRetrying(false)))}
          >
            <RefreshCw size={16} className={retrying ? "animate-spin" : undefined} /> Reintentar
          </Button>
        </Card>
      )}
      {account.expired && account.status !== "user" && (
        <Card tone="gold" className="mb-4 flex items-center gap-2 font-semibold">
          <UserRound size={20} className="shrink-0" /> Tu sesión ha terminado. Vuelve a entrar para seguir
          guardando tu progreso.
        </Card>
      )}
      {account.status === "user" ? <AccountPanel account={account} /> : <AuthForm account={account} />}
    </div>
  );
}
