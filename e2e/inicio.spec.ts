import { expect, test } from "./fixtures";

test.describe("inicio como invitado", () => {
  test("presenta la app, el modo invitado y las lecciones", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/sinophile/);
    await expect(page.getByRole("link", { name: /Estás en modo invitado/ })).toHaveAttribute(
      "href",
      "/cuenta",
    );
    await expect(page.getByText("7 lecciones")).toBeVisible();
    await expect(page.getByRole("link", { name: "Lección 7", exact: true })).toHaveAttribute(
      "href",
      "/leccion?id=7",
    );
    for (const modo of ["Repaso", "Infinito", "Examen", "Escritura", "Tarjetas"]) {
      await expect(page.getByRole("main").getByRole("link", { name: modo, exact: true })).toBeVisible();
    }
  });

  test("resume el vocabulario frente al HSK 2 (HSK 3.0, 500 palabras)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tu vocabulario" })).toBeVisible();
    await expect(page.getByText("0/500")).toBeVisible();
    await page.getByText("Ver las palabras del HSK 2").click();
    await expect(page.getByRole("region", { name: "Nivel 1" }).getByRole("listitem")).toHaveCount(300);
    await expect(page.getByRole("region", { name: "Nivel 2" }).getByRole("listitem")).toHaveCount(200);
  });

  test("la navegación lleva a cada sección", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("complementary");
    for (const [nombre, ruta, titulo] of [
      ["Practicar", "/practicar", "Practicar"],
      ["Diccionario", "/diccionario", "Diccionario"],
      ["Ajustes", "/ajustes", "Ajustes"],
    ]) {
      await nav.getByRole("link", { name: nombre, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${ruta}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo);
    }
  });
});
