/**
 * zod for the whole app (browser, API and scripts): import it from here, not from "zod"
 * (eslint.config.mjs enforces it).
 *
 * zod 4 compiles its validators with `new Function` when it can, and probes for that first; the
 * Content Security Policy (src/server/security-headers.ts) forbids eval, so in the browser the
 * probe would show up as a violation. In jitless mode it never tries, and validates the same.
 */
import { z } from "zod";

z.config({ jitless: true });

export { z };
