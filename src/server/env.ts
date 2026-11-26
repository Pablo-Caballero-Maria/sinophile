/**
 * The server's environment variables, checked with zod (server only). Read when the first
 * request needs them, not at build time.
 */
import { z } from "../lib/zod.ts";

const envSchema = z
  .object({
    MONGODB_URI: z
      .string({ error: "Falta la variable de entorno MONGODB_URI." })
      .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI debe empezar por mongodb:// o mongodb+srv://."),
    MONGODB_DB: z
      .string()
      .optional()
      .transform((name) => name || "sinophile"),
    /** Signs the session cookies (Better Auth reads it too). `openssl rand -base64 32` gives 44 characters. */
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres.")
      .optional(),
    /** "off" turns Better Auth's per-IP limit off (the end-to-end tests: every browser shares one IP). */
    AUTH_RATE_LIMIT: z.enum(["on", "off"]).default("on"),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  })
  .refine((env) => env.BETTER_AUTH_SECRET || !env.VERCEL_ENV || env.VERCEL_ENV === "development", {
    path: ["BETTER_AUTH_SECRET"],
    error: "Falta la variable de entorno BETTER_AUTH_SECRET (obligatoria en Vercel).",
  });

export type ServerEnv = z.infer<typeof envSchema>;

/** Parses the environment; throws one error listing every problem. */
export function parseEnv(env: Readonly<Record<string, string | undefined>> = process.env): ServerEnv {
  const result = envSchema.safeParse(env);
  if (result.success) return result.data;
  throw new Error(result.error.issues.map((issue) => issue.message).join(" "));
}

let cached: ServerEnv | undefined;
/** The process's environment, parsed once. */
export const serverEnv = (): ServerEnv => (cached ??= parseEnv());
