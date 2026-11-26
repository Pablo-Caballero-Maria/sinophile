import { expect, test } from "./fixtures";

// Los fixtures hacen fallar un test ante cualquier error de la consola: un script, estilo o
// petición que el CSP bloquee en cualquier otro test lo hace fallar también.
test.describe("cabeceras de seguridad", () => {
  for (const ruta of ["/", "/cuenta", "/data/exercises.json", "/api/account"]) {
    test(`llegan con ${ruta}`, async ({ request }) => {
      const cabeceras = (await request.get(ruta)).headers();
      const csp = cabeceras["content-security-policy"];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain(
        "connect-src 'self' https://translate.googleapis.com https://api.mymemory.translated.net https://cdn.jsdelivr.net",
      );
      expect(csp).toContain("frame-ancestors 'none'");
      expect(cabeceras["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
      expect(cabeceras["x-content-type-options"]).toBe("nosniff");
      expect(cabeceras["x-frame-options"]).toBe("DENY");
      expect(cabeceras["permissions-policy"]).toContain("microphone=(self)");
      expect(cabeceras["x-powered-by"]).toBeUndefined();
    });
  }
});

test.describe("el CSP", () => {
  // Un solo patrón: Playwright lee un array de dos elementos como [valor, opciones].
  test.use({
    erroresPermitidos: [
      /violates the following Content Security Policy|CSP violation: script-src-elem blocked https:\/\/example\.org\//,
    ],
  });

  test("bloquea los scripts de otros sitios", async ({ page }) => {
    await page.goto("/");
    const violaciones = await page.evaluate(
      () =>
        new Promise<{ directive: string; blocked: string }[]>((resolve) => {
          const vistas: { directive: string; blocked: string }[] = [];
          document.addEventListener("securitypolicyviolation", (event) =>
            vistas.push({ directive: event.violatedDirective, blocked: event.blockedURI }),
          );
          const script = document.createElement("script");
          script.src = "https://example.org/malicioso.js";
          script.onerror = () => setTimeout(() => resolve(vistas), 200);
          document.head.append(script);
        }),
    );
    expect(violaciones).toEqual([
      { directive: "script-src-elem", blocked: "https://example.org/malicioso.js" },
    ]);
  });
});
