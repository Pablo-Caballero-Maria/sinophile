/**
 * El service worker (src/sw/worker.ts): tras la primera visita, la app abre y funciona sin conexión,
 * también páginas que aún no se habían visitado; y el tema claro/oscuro.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/** Espera a que el service worker controle la página y haya guardado las páginas de la app. */
async function esperarServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve));
  });
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.open("pages")).keys()).length))
    .toBeGreaterThanOrEqual(9);
}

test.describe("sin conexión", () => {
  // Sin red, la API no responde: la app lo anota en la consola y sigue en modo invitado.
  test.use({ erroresPermitidos: [/Failed to load resource|ERR_INTERNET_DISCONNECTED/] });

  test("abre páginas no visitadas y practica sin conexión", async ({ page, context }) => {
    await page.goto("/");
    await esperarServiceWorker(page);
    await context.setOffline(true);

    await page.goto("/diccionario");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Diccionario");
    await page.goto("/leccion?id=2");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lección 2");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lección 2");

    await context.setOffline(false);
  });
});

test("el tema es claro por defecto y el botón de la barra lo cambia", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Cambiar al tema oscuro" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#121315");
  await page.getByRole("button", { name: "Cambiar al tema claro" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});
