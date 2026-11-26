"use client";
/** Top-bar button that switches between the light theme (the default) and the dark one. */
import { Moon, Sun } from "lucide-react";
import { otherTheme } from "@/lib/settings/theme";
import { updateSettings, useSettings } from "@/lib/settings/store";

export function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const next = otherTheme(theme);
  const label = next === "dark" ? "Cambiar al tema oscuro" : "Cambiar al tema claro";
  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: next })}
      aria-label={label}
      title={label}
      className="rounded-xl p-2 text-muted hover:bg-surface-2"
    >
      {theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}
