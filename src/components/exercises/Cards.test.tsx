// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { flashcard } from "@/lib/exercises/generate";
import type { CardFront, Exercise } from "@/lib/exercises/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/model";
import { settingsStore } from "@/lib/settings/store";

import { FlashcardExercise } from "./Cards";

vi.mock("@/lib/speech", async (original) => ({
  ...(await original<typeof import("@/lib/speech")>()),
  speak: vi.fn(() => Promise.resolve()),
}));

const word = { id: "diannao", hanzi: "电脑", pinyin: "diànnǎo", es: "ordenador", lesson: "7" };

function show(front: CardFront) {
  const onAnswer = vi.fn();
  const card = flashcard(word, front) as Extract<Exercise, { type: "flashcard" }>;
  render(
    <FlashcardExercise
      exercise={card}
      answered={false}
      onAnswer={onAnswer}
      onSkip={vi.fn()}
      onPractice={vi.fn()}
    />,
  );
  return onAnswer;
}

afterEach(() => settingsStore.set(DEFAULT_SETTINGS));

describe("FlashcardExercise", () => {
  it("starts with the Spanish and turns to the hanzi, the pinyin and the sound", async () => {
    show("es");
    const card = screen.getByRole("button", { name: "Dar la vuelta a la tarjeta" });
    expect(card).toHaveTextContent("ordenador");
    expect(card).not.toHaveTextContent("diànnǎo");
    await userEvent.click(card);
    expect(card).toHaveTextContent("diànnǎo");
    expect(screen.getAllByRole("button", { name: /Escuchar/ }).length).toBeGreaterThan(0);
  });

  it("starts with the pinyin and shows the rest, the meaning included", async () => {
    const onAnswer = show("pinyin");
    expect(screen.getByRole("button", { name: "Dar la vuelta a la tarjeta" })).not.toHaveTextContent(
      "ordenador",
    );
    await userEvent.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
    expect(screen.getByText("ordenador")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Me la sabía" }));
    expect(onAnswer).toHaveBeenCalledWith({ correct: true });
  });

  it("starts with the sound: nothing written until it turns", async () => {
    show("audio");
    const card = screen.getByRole("button", { name: "Dar la vuelta a la tarjeta" });
    expect(card).toHaveTextContent("Escucha la palabra");
    expect(card).not.toHaveTextContent("电");
    expect(card).not.toHaveTextContent("ordenador");
    await userEvent.click(card);
    expect(screen.getByText("ordenador")).toBeInTheDocument();
  });
});
