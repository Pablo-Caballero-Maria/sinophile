/**
 * Tests de extremo a extremo (`npm run test:e2e`): el build de producción (`npm run build` antes)
 * servido con `next start` y manejado en un Chromium real.
 *
 * Las cuentas necesitan un MongoDB: por defecto `mongodb://127.0.0.1:27017` y la base de datos
 * `sinophile_e2e` (MONGODB_URI y MONGODB_DB lo cambian). El navegador es el Chromium de Playwright
 * (`npx playwright install chromium`); PW_CHANNEL (p. ej. `chrome`) o PW_EXECUTABLE_PATH usan otro.
 */
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3110);

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "es-ES",
    channel: process.env.PW_CHANNEL,
    launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start --port ${PORT} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
      MONGODB_DB: process.env.MONGODB_DB ?? "sinophile_e2e",
    },
  },
});
