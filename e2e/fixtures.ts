/**
 * El `page` de los tests, que hace fallar el test ante cualquier error en la consola o excepción
 * sin capturar: así no se cuela un script roto ni un error de hidratación. Un test que provoca a
 * propósito una respuesta de error de la API declara qué mensajes espera con
 * `test.use({ erroresPermitidos: [/401/] })`.
 */
import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ erroresPermitidos: RegExp[] }>({
  erroresPermitidos: [[], { option: true }],
  page: async ({ page, erroresPermitidos }, runTest) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (erroresPermitidos.some((patron) => patron.test(message.text()))) return;
      problems.push(`consola: ${message.text()}`);
    });
    // Lo que bloquea el CSP no siempre llega a la consola: cada violación pasa a ser un error.
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) =>
        console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`),
      ),
    );
    page.on("pageerror", (error) => problems.push(`error de la página: ${error.message}`));
    await runTest(page);
    expect(problems, "la página registró errores").toEqual([]);
  },
});

export { expect };
