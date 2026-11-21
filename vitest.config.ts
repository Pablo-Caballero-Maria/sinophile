import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Node para la lógica y la API; los tests de componentes piden jsdom (`// @vitest-environment jsdom`)
    // y usan Testing Library (vitest.setup.ts).
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      // La cobertura mide la lógica y la API, no las páginas ni los componentes de React.
      include: ["src/lib/**/*.ts", "src/server/**/*.ts", "src/app/api/**/*.ts", "scripts/**/*.ts"],
      exclude: ["**/*.test.ts", "src/generated/**"],
      reporter: ["text-summary", "json-summary", "lcov", "html"],
    },
  },
});
