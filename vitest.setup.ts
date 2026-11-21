/**
 * Para los tests de componentes (los que piden `// @vitest-environment jsdom`): los matchers de
 * jest-dom (toBeChecked, toBeInTheDocument…) y una página limpia tras cada test.
 */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sin `globals: true`, Testing Library no desmonta los componentes entre tests por sí sola.
afterEach(() => cleanup());
