// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/settings/model";
import { settingsStore } from "@/lib/settings/store";

import { SilentModeCheckbox } from "./SilentMode";
import { Segmented, Toggle } from "./UI";

afterEach(() => settingsStore.set(DEFAULT_SETTINGS));

describe("Segmented", () => {
  it("marca la opción elegida y avisa al elegir otra", async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        value="auto"
        onChange={onChange}
        options={[
          { value: "auto", label: "Automático" },
          { value: "dark", label: "Oscuro" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Automático" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Oscuro" })).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});

describe("Toggle", () => {
  it("es un interruptor que pide el valor contrario", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Pinyin" />);
    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("SilentModeCheckbox", () => {
  it("activa y desactiva el modo silencioso en los ajustes", async () => {
    render(<SilentModeCheckbox />);
    const box = screen.getByRole("checkbox", { name: /Modo silencioso/ });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(settingsStore.get().silentMode).toBe(true);
    await userEvent.click(box);
    expect(settingsStore.get().silentMode).toBe(false);
  });
});
