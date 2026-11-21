import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "./fixtures";

/** Las lecciones de data/: número y palabras de cada una, para comprobar lo que muestra la web. */
const lecciones = readdirSync(join(process.cwd(), "data"))
  .flatMap((carpeta) => {
    const numero = /^lección (\d+)$/.exec(carpeta)?.[1];
    if (!numero) return [];
    const vocab = JSON.parse(readFileSync(join(process.cwd(), "data", carpeta, "vocab.json"), "utf8")) as unknown[];
    return [{ numero: Number(numero), palabras: vocab.length }];
  })
  .sort((a, b) => a.numero - b.numero);

test("cada lección de data/ tiene su página con todas sus palabras", async ({ page }) => {
  expect(lecciones.length).toBeGreaterThan(0);
  for (const { numero, palabras } of lecciones) {
    await page.goto(`/leccion?id=${numero}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Lección ${numero}`);
    await expect(page.getByText(`${palabras} palabras`, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(palabras);
  }
});

test("una lección empieza presentando sus palabras", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Continuar lección 1" }).click();
  await expect(page).toHaveURL(/\/sesion\?modo=leccion&l=1$/);
  await expect(page.getByText("Palabra nueva")).toBeVisible();
  await expect(page.getByText("你好", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("hola", { exact: true })).toBeVisible();
  const progreso = page.getByRole("banner").getByRole("progressbar");
  await expect(progreso).toHaveAttribute("aria-valuenow", "0");

  await page.getByRole("button", { name: "¡Entendido!" }).click();
  // La sesión avanza: la barra de progreso deja de estar a 0.
  await expect(progreso).not.toHaveAttribute("aria-valuenow", "0");

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).not.toHaveURL(/\/sesion/);
});

test("el modo silencioso quita los modos de escucha y de pronunciación", async ({ page }) => {
  await page.goto("/practicar");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /^Escucha/ })).toBeVisible();
  await expect(main.getByRole("link", { name: /^Pronunciación/ })).toBeVisible();

  await main.getByRole("checkbox", { name: /Modo silencioso/ }).check();
  await expect(main.getByRole("link", { name: /^Escucha/ })).toHaveCount(0);
  await expect(main.getByRole("link", { name: /^Pronunciación/ })).toHaveCount(0);
  await expect(main.getByRole("link", { name: /^Pinyin y tonos/ })).toBeVisible();
});

test("el examen se configura antes de empezar", async ({ page }) => {
  await page.goto("/practicar#examen");
  await expect(page.getByRole("radio", { name: "20 preguntas" })).toBeChecked();
  await page.getByRole("radio", { name: "10 preguntas" }).click();
  await expect(page.getByRole("radio", { name: "10 preguntas" })).toBeChecked();
  await expect(page.getByRole("link", { name: "Empezar examen" })).toBeVisible();
});
