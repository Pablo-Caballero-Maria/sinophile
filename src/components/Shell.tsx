"use client";
/** App chrome: top bar with streak/XP and account, bottom tab bar on phones, side bar on wide screens. */
import { BookOpen, ChartColumn, CloudOff, Dumbbell, Flame, House, LogIn, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { bootAccount, useAccount, useReady } from "@/lib/account/client";
import { streakInfo, totalXp } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/store";
import { applyTheme, useSettings } from "@/lib/settings/store";
import { dayKey } from "@/lib/text";
import { ThemeToggle } from "./ThemeToggle";
import { cn, Skeleton } from "./UI";

const NAV = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/practicar", label: "Practicar", icon: Dumbbell },
  { href: "/diccionario", label: "Diccionario", icon: BookOpen },
  { href: "/progreso", label: "Progreso", icon: ChartColumn },
];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" || pathname.startsWith("/leccion") : pathname.startsWith(href);

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="sinophile, inicio">
      <span
        lang="zh-CN"
        className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-hanzi text-xl font-bold text-white shadow-sm"
      >
        汉
      </span>
      <span className="text-xl font-black tracking-tight max-[400px]:hidden">sinophile</span>
    </Link>
  );
}

function Stats() {
  const ready = useReady();
  const progress = useProgress();
  const settings = useSettings();
  if (!ready) return <Skeleton className="h-8 w-28" />;
  const streak = streakInfo(progress);
  const today = progress.days[dayKey()]?.xp ?? 0;
  return (
    <div className="flex items-center gap-1.5 text-sm font-bold">
      <Link
        href="/progreso"
        className={cn(
          "flex items-center gap-1 rounded-xl px-2 py-1",
          streak.practicedToday ? "text-gold" : "text-muted",
        )}
        title="Racha de días"
      >
        <Flame size={20} className={streak.practicedToday ? "fill-gold" : undefined} />
        {streak.current}
      </Link>
      <Link
        href="/progreso"
        className="flex items-center gap-1 rounded-xl px-2 py-1 text-sky"
        title={`Hoy: ${today}/${settings.dailyGoal} XP`}
      >
        <Zap size={20} className="fill-sky" />
        {totalXp(progress)}
      </Link>
    </div>
  );
}

/** Guest: "Entrar" button. Signed in: initial of the username (+ a warning when changes could not be saved). */
function AccountButton() {
  const account = useAccount();
  if (account.status === "loading") return <Skeleton className="h-9 w-9 rounded-full" />;
  if (account.status !== "user")
    return (
      <Link
        href="/cuenta"
        className="flex items-center gap-1 rounded-xl border-2 border-line px-2.5 py-1 text-sm font-bold text-sky hover:bg-surface-2"
      >
        <LogIn size={18} /> Entrar
      </Link>
    );
  const failed = account.save === "error";
  return (
    <Link
      href="/cuenta"
      aria-label={`Cuenta de ${account.username}`}
      title={
        failed ? "No se pudo guardar tu progreso; se reintentará." : `Sesión iniciada: ${account.username}`
      }
      className="relative grid h-9 w-9 place-items-center rounded-full bg-sky text-base font-black text-white uppercase"
    >
      {account.username?.[0]}
      {failed && (
        <CloudOff size={16} className="absolute -right-1 -bottom-1 rounded-full bg-bad p-0.5 text-white" />
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => void bootAccount(), []);

  // Practice sessions are full-screen and distraction-free.
  if (pathname.startsWith("/sesion")) return <>{children}</>;

  return (
    <div className="lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-2 border-r border-line p-4 lg:flex">
        <div className="mb-6 px-2 pt-2">
          <Logo />
        </div>
        {[...NAV, { href: "/ajustes", label: "Ajustes", icon: Settings }].map(
          ({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 font-bold transition-colors",
                isActive(pathname, href)
                  ? "border-sky/40 bg-sky-soft text-sky"
                  : "border-transparent text-muted hover:bg-surface-2",
              )}
            >
              <Icon size={22} />
              {label}
            </Link>
          ),
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <header
          className="sticky top-0 z-30 border-b border-line bg-bg/90"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <div className="lg:invisible">
              <Logo />
            </div>
            <div className="flex items-center gap-1">
              <Stats />
              <ThemeToggle />
              <Link
                href="/ajustes"
                aria-label="Ajustes"
                className="rounded-xl p-2 text-muted hover:bg-surface-2 lg:hidden"
              >
                <Settings size={22} />
              </Link>
              <AccountButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 pt-4 pb-28 lg:pb-12">{children}</main>
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 lg:hidden">
        <div className="mx-auto flex max-w-3xl justify-around px-2 pt-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex w-20 flex-col items-center gap-0.5 rounded-xl py-1 text-xs font-bold",
                isActive(pathname, href) ? "text-sky" : "text-muted",
              )}
            >
              <Icon size={24} strokeWidth={isActive(pathname, href) ? 2.6 : 2} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
