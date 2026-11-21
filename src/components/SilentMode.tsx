"use client";
/** Checkbox for silent mode, shown wherever a practice mode can be started. */
import { updateSettings, useSettings } from "@/lib/settings/store";
import { Checkbox } from "./UI";

export function SilentModeCheckbox({ className }: { className?: string }) {
  const { silentMode } = useSettings();
  return (
    <Checkbox
      className={className}
      checked={silentMode}
      onChange={(checked) => updateSettings({ silentMode: checked })}
      label="Modo silencioso"
      description="Sin ejercicios de escucha ni de pronunciación, y sin ningún sonido."
    />
  );
}
