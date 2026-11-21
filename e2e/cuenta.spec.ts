/** Cuentas de extremo a extremo: la API real contra MongoDB (ver playwright.config.ts). */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const CONTRASENA = "una contraseña de prueba";

function usuarioNuevo(): string {
  return `e2e_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function crearCuenta(page: Page, usuario: string) {
  await page.goto("/cuenta");
  await page.getByRole("radio", { name: "Crear cuenta" }).click();
  await page.getByRole("textbox", { name: "Nombre de usuario" }).fill(usuario);
  await page.getByRole("textbox", { name: /^Contraseña/ }).fill(CONTRASENA);
  await page.getByRole("textbox", { name: "Repite la contraseña" }).fill(CONTRASENA);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("link", { name: `Cuenta de ${usuario}` })).toBeVisible();
}

test("crear una cuenta, cerrar sesión y volver a entrar", async ({ page }) => {
  const usuario = usuarioNuevo();
  await crearCuenta(page, usuario);
  await expect(page.getByRole("link", { name: /Estás en modo invitado/ })).toHaveCount(0);

  await page.goto("/cuenta");
  await expect(page.getByText(usuario, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  await page.goto("/cuenta");
  await page.getByRole("textbox", { name: "Nombre de usuario" }).fill(usuario);
  await page.getByRole("textbox", { name: /^Contraseña/ }).fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).last().click();
  await expect(page.getByRole("link", { name: `Cuenta de ${usuario}` })).toBeVisible();
});

test("los ajustes se guardan en la cuenta", async ({ page }) => {
  await crearCuenta(page, usuarioNuevo());
  await page.goto("/ajustes");
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/settings") && r.request().method() === "PUT");
  await page.getByRole("radio", { name: "Seria · 100" }).click();
  expect((await saved).ok()).toBe(true);

  await page.reload();
  await expect(page.getByRole("radio", { name: "Seria · 100" })).toBeChecked();
  await page.goto("/");
  await expect(page.getByText("/100")).toBeVisible();
});

test.describe("con una contraseña incorrecta", () => {
  // La API responde 401 y el navegador lo anota en la consola: aquí es lo esperado.
  test.use({ erroresPermitidos: [/status of 401/] });

  test("no se entra", async ({ page }) => {
    const usuario = usuarioNuevo();
    await crearCuenta(page, usuario);
    await page.goto("/cuenta");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

    await page.goto("/cuenta");
    await page.getByRole("textbox", { name: "Nombre de usuario" }).fill(usuario);
    await page.getByRole("textbox", { name: /^Contraseña/ }).fill("otra contraseña");
    await page.getByRole("button", { name: "Entrar" }).last().click();
    await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();
    await expect(page.getByRole("link", { name: `Cuenta de ${usuario}` })).toHaveCount(0);
  });
});
