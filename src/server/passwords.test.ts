import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isLegacyHash, passwordHasher, verifyLegacyPassword } from "./passwords";

const legacy = async (password: string, N = 16384) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFC"), salt, 32, {
    N,
    r: 8,
    p: 1,
  });
  return ["scrypt", N, 8, 1, salt.toString("base64"), hash.toString("base64")].join("$");
};

describe("passwords", () => {
  it("hashes new passwords with Better Auth's scrypt and verifies them", async () => {
    const hash = await passwordHasher.hash("una contraseña");
    expect(isLegacyHash(hash)).toBe(false);
    expect(hash).not.toContain("contraseña");
    expect(await passwordHasher.verify({ hash, password: "una contraseña" })).toBe(true);
    expect(await passwordHasher.verify({ hash, password: "otra contraseña" })).toBe(false);
  });

  it("still verifies hashes from before Better Auth, with the parameters stored in them", async () => {
    const hash = await legacy("contraseña-antigua", 1024);
    expect(isLegacyHash(hash)).toBe(true);
    expect(await passwordHasher.verify({ hash, password: "contraseña-antigua" })).toBe(true);
    expect(await passwordHasher.verify({ hash, password: "contraseña-nueva" })).toBe(false);
  });

  it("normalises Unicode like the old hashes did (é typed as one or two code points)", async () => {
    const hash = await legacy("café", 1024);
    expect(await verifyLegacyPassword("café", hash)).toBe(true);
  });

  it("rejects malformed legacy hashes", async () => {
    expect(await verifyLegacyPassword("x", "scrypt$1024$8$1$")).toBe(false);
    expect(await verifyLegacyPassword("x", "bcrypt$whatever")).toBe(false);
  });
});
