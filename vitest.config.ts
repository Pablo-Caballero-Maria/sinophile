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
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // La lógica y la API; las páginas y los componentes de React no tienen tests unitarios.
      include: ["src/lib/**/*.ts", "src/server/**/*.ts", "src/app/api/**/*.ts", "scripts/**/*.ts"],
      exclude: ["**/*.test.ts", "src/generated/**"],
      reporter: ["text-summary", "json-summary", "lcov", "html"],
    },
  },
});
