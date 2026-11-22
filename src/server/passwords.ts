/**
 * Password hashing for Better Auth (server only).
 *
 * New passwords use Better Auth's own scrypt hash. Accounts created before Better Auth kept their hash
 * ("scrypt$N$r$p$<salt base64>$<hash base64>", node:crypto scrypt over the NFC-normalised password)
 * when they were moved over (legacy.ts), so verify() understands both formats and nobody has to
 * reset their password.
 */
import { scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { hashPassword as hashCurrent, verifyPassword as verifyCurrent } from "better-auth/crypto";

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key))),
  );

const LEGACY_PREFIX = "scrypt$";

export const isLegacyHash = (hash: string): boolean => hash.startsWith(LEGACY_PREFIX);

/** Checks a password against a hash from before Better Auth. */
export async function verifyLegacyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize("NFC"), Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** `emailAndPassword.password` of the Better Auth options. */
export const passwordHasher = {
  hash: (password: string): Promise<string> => hashCurrent(password),
  verify: ({ hash, password }: { hash: string; password: string }): Promise<boolean> =>
    isLegacyHash(hash) ? verifyLegacyPassword(password, hash) : verifyCurrent({ hash, password }),
};
