"use client";
/**
 * /cuenta — sign in / sign up (guests) or account management (signed-in users). The forms are
 * react-hook-form with the zod schemas of lib/account/types.ts; the calls are TanStack Query
 * mutations (their pending and error states drive the buttons and messages).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { CloudCheck, CloudOff, LoaderCircle, LogOut, RefreshCw, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
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
import {
  deleteAccountSchema,
  PASSWORD_MIN,
  signInFormSchema,
  signUpFormSchema,
  type AuthFormInput,
  type Credentials,
} from "@/lib/account/types";
import { isEmptyProgress, totalXp } from "@/lib/progress/model";
import { rise } from "@/lib/motion";
import { useProgress } from "@/lib/progress/store";
import type { z } from "@/lib/zod";

const INPUT = "h-12 rounded-xl border-2 border-line bg-bg px-3 font-normal outline-none focus:border-sky";

/** A field's error, announced when it appears. */
function FieldError({ message }: { message: string | undefined }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.p key="error" {...rise} role="alert" className="text-sm font-semibold text-bad">
          {message}
        </m.p>
      )}
    </AnimatePresence>
  );
}

/** A labelled field, with its error (if any) under it, announced when it appears. */
function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {label}
        {children}
      </label>
      <FieldError message={error} />
    </div>
  );
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Algo ha fallado. Inténtalo de nuevo.";

const EMPTY_FORM: AuthFormInput = { username: "", password: "", repeat: "" };

function AuthForm({ account }: { account: AccountState }) {
  const router = useRouter();
  const progress = useProgress();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [adopt, setAdopt] = useState(true);
  const hasLocal = !isEmptyProgress(progress);
  const register = mode === "register";
  // react-hook-form keeps the fields; zod checks them (a new account's rules, or just "not empty").
  const {
    register: field,
    handleSubmit,
    clearErrors,
    formState: { errors },
  } = useForm<AuthFormInput, unknown, Credentials>({
    resolver: zodResolver(register ? signUpFormSchema : signInFormSchema),
    defaultValues: EMPTY_FORM,
  });
  const auth = useMutation({
    mutationFn: (credentials: Credentials) => (register ? signUp : signIn)(credentials, adopt),
    onSuccess: () => router.push("/"),
  });
  // Still disabled after success, while the home page loads.
  const busy = auth.isPending || auth.isSuccess;

  return (
    <Card className="flex flex-col gap-4">
      <Segmented
        value={mode}
        onChange={(m) => (setMode(m), auth.reset(), clearErrors())}
        options={[
          { value: "login", label: "Iniciar sesión" },
          { value: "register", label: "Crear cuenta" },
        ]}
      />
      <form
        noValidate
        onSubmit={handleSubmit((credentials) => auth.mutate(credentials))}
        className="flex flex-col gap-3"
      >
        <Field label="Nombre de usuario" error={errors.username?.message}>
          <input
            className={INPUT}
            {...field("username")}
            aria-invalid={errors.username ? true : undefined}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field
          label={register ? `Contraseña (mínimo ${PASSWORD_MIN} caracteres)` : "Contraseña"}
          error={errors.password?.message}
        >
          <input
            className={INPUT}
            type="password"
            {...field("password")}
            aria-invalid={errors.password ? true : undefined}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </Field>
        {register && (
          <Field label="Repite la contraseña" error={errors.repeat?.message}>
            <input
              className={INPUT}
              type="password"
              {...field("repeat")}
              aria-invalid={errors.repeat ? true : undefined}
              autoComplete="new-password"
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
        {auth.error && <p className="text-sm font-semibold text-bad">{errorText(auth.error)}</p>}
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
  const leave = { onSuccess: () => router.push("/") };
  const exit = useMutation({ mutationFn: signOut, ...leave });
  const remove = useMutation({ mutationFn: deleteAccount, ...leave });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof deleteAccountSchema>, unknown, z.output<typeof deleteAccountSchema>>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });
  const busy = exit.isPending || exit.isSuccess || remove.isPending || remove.isSuccess;
  const error = exit.error ?? remove.error;

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
        <Button variant="secondary" onClick={() => exit.mutate()} disabled={busy} className="self-start">
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
            noValidate
            className="flex flex-col gap-3 rounded-2xl bg-bad-soft p-3"
            onSubmit={handleSubmit(({ password }) => remove.mutate(password))}
          >
            <p className="text-sm font-semibold text-bad">
              Se borrarán tu cuenta, tu progreso y tus ajustes. No se puede deshacer. Escribe tu contraseña
              para confirmarlo.
            </p>
            <input
              className={INPUT}
              type="password"
              aria-label="Tu contraseña"
              {...register("password")}
              aria-invalid={errors.password ? true : undefined}
              autoComplete="current-password"
            />
            <FieldError message={errors.password?.message} />
            <div className="flex gap-2">
              <Button type="submit" variant="bad" size="sm" disabled={busy}>
                Sí, borrar mi cuenta
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>
      {error && <p className={cn("mt-3 text-sm font-semibold text-bad")}>{errorText(error)}</p>}
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
