import { expect, test } from "./fixtures";

test("busca por español y por pinyin sin tonos", async ({ page }) => {
  await page.goto("/diccionario");
  const buscador = page.getByRole("searchbox");

  await buscador.fill("hola");
  await expect(page.getByRole("link", { name: /^你好 nǐ hǎo/ }).first()).toBeVisible();

  await buscador.fill("laoshi");
  await expect(page.getByRole("link", { name: /^老师 lǎoshī/ }).first()).toBeVisible();
});

test("encuentra palabras de CC-CEDICT que no están en las lecciones", async ({ page }) => {
  await page.goto("/diccionario");
  await page.getByRole("searchbox").fill("电脑");
  // CC-CEDICT (7 MB) se descarga y se indexa al buscar; en la primera visita compite con la
  // instalación del service worker.
  await expect(page.getByText(/computer/i).first()).toBeVisible({ timeout: 15_000 });
});

test("la ficha de una palabra muestra trazos y ejemplos", async ({ page }) => {
  await page.goto("/diccionario");
  await page.getByRole("link", { name: /^你好 nǐ hǎo hola/ }).click();
  await expect(page).toHaveURL(/\/palabra\?id=ni-hao$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("你好");
  await expect(page.getByRole("heading", { name: "Caracteres y orden de trazos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trazar" })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Frases de ejemplo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lección 1" })).toHaveAttribute("href", "/leccion?id=1");
});

test("tiene un traductor", async ({ page }) => {
  await page.goto("/diccionario");
  await page.getByRole("radio", { name: "Traductor" }).click();
  await expect(page.getByRole("radio", { name: "Traductor" })).toBeChecked();
});
