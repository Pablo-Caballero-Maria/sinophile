import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const URI = "mongodb+srv://user:pass@cluster.example.net";
const SECRET = "x".repeat(44);

describe("parseEnv", () => {
  it("reads the variables, with defaults", () => {
    expect(parseEnv({ MONGODB_URI: URI })).toEqual({
      MONGODB_URI: URI,
      MONGODB_DB: "sinophile",
      AUTH_RATE_LIMIT: "on",
    });
    expect(parseEnv({ MONGODB_URI: URI, MONGODB_DB: "", AUTH_RATE_LIMIT: "off" })).toMatchObject({
      MONGODB_DB: "sinophile",
      AUTH_RATE_LIMIT: "off",
    });
  });

  it("explains every problem at once", () => {
    expect(() => parseEnv({ MONGODB_URI: "http://example.org", BETTER_AUTH_SECRET: "short" })).toThrow(
      "MONGODB_URI debe empezar por mongodb:// o mongodb+srv://. BETTER_AUTH_SECRET debe tener al menos 32 caracteres.",
    );
    expect(() => parseEnv({})).toThrow("Falta la variable de entorno MONGODB_URI.");
  });

  it("requires the session secret on Vercel, not locally", () => {
    expect(() => parseEnv({ MONGODB_URI: URI, VERCEL_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => parseEnv({ MONGODB_URI: URI, VERCEL_ENV: "preview" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(
      parseEnv({ MONGODB_URI: URI, VERCEL_ENV: "production", BETTER_AUTH_SECRET: SECRET }).BETTER_AUTH_SECRET,
    ).toBe(SECRET);
    expect(parseEnv({ MONGODB_URI: URI, VERCEL_ENV: "development" }).BETTER_AUTH_SECRET).toBeUndefined();
  });
});
