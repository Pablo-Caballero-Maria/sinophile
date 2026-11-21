/**
 * Small presentational building blocks (buttons, cards, bars, skeletons…).
 * Styling relies on the design tokens defined in globals.css.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ok" | "bad" | "gold" | "sky" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white border-brand-strong",
  secondary: "bg-surface text-fg border-line border-2 border-b-4",
  ok: "bg-ok text-white border-ok-strong",
  bad: "bg-bad text-white border-bad-strong",
  gold: "bg-gold text-white border-gold-strong",
  sky: "bg-sky text-white border-sky-strong",
  ghost: "bg-transparent text-muted border-transparent hover:bg-surface-2",
};

const SIZES = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-12 px-5 rounded-2xl",
  lg: "h-14 px-6 text-lg rounded-2xl",
};

interface ButtonStyle {
  variant?: Variant;
  size?: keyof typeof SIZES;
  full?: boolean;
}

const buttonClass = ({ variant = "primary", size = "md", full }: ButtonStyle, className?: string) =>
  cn(
    "inline-flex select-none items-center justify-center gap-2 font-bold tracking-wide transition-[transform,filter] duration-75",
    variant !== "ghost" && variant !== "secondary" && "border-b-4",
    "active:translate-y-[2px] active:border-b-2 hover:brightness-105",
    "disabled:pointer-events-none disabled:border-line disabled:bg-surface-2 disabled:text-muted",
    VARIANTS[variant],
    SIZES[size],
    full && "w-full",
    className,
  );

export function Button({ variant, size, full, className, ...props }: ButtonStyle & ComponentProps<"button">) {
  return <button type="button" className={buttonClass({ variant, size, full }, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  full,
  className,
  ...props
}: ButtonStyle & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size, full }, className)} {...props} />;
}

const CARD_TONES = {
  default: "border-line bg-surface",
  gold: "border-gold bg-gold-soft",
  sky: "border-sky/40 bg-sky-soft",
};

/** Rounded panel. Use `tone` (not className) to change its colours, so classes never conflict. */
export function Card({
  className,
  tone = "default",
  ...props
}: ComponentProps<"div"> & { tone?: keyof typeof CARD_TONES }) {
  return <div className={cn("rounded-3xl border p-4", CARD_TONES[tone], className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-xl", className)} />;
}

export function ProgressBar({
  value,
  className,
  barClassName = "bg-ok",
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cn("h-3 overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Circular progress (daily goal). */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = "var(--gold)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Stars({ count, max = 3, className }: { count: number; max?: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${count} de ${max} estrellas`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={cn("h-4 w-4", i < count ? "fill-gold" : "fill-line")}>
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Segmented control (single choice). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-2xl bg-surface-2 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            o.value === value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 py-1", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 shrink-0 cursor-pointer accent-sky"
      />
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-ok" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between">
      <h2 className="text-lg font-extrabold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="text-5xl">{icon}</div>
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="max-w-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
}) {
  return (
    <header className="mb-4">
      {back && (
        <Link
          href={back}
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg"
        >
          ← Volver
        </Link>
      )}
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </header>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
        className ?? "bg-surface-2 text-muted",
      )}
    >
      {children}
    </span>
  );
}
