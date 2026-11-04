/**
 * Passwords and sign-in sessions (server only).
 *
 * - Passwords are hashed with scrypt (node:crypto, memory-hard) and a random
 *   salt; the parameters are stored with the hash so they can be raised later.
 * - A session is a random token kept in an HttpOnly cookie (the only thing the
 *   browser stores). The database keeps only its SHA-256.
 */
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key))),
  );

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 32;

/** "scrypt$N$r$p$<salt base64>$<hash base64>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFC"), salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize("NFC"), Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A valid hash of a random password: verifying against it makes "unknown user" as slow as "wrong password". */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(KEY_LENGTH).toString("base64");

/* ───────────── sessions ───────────── */

export const SESSION_COOKIE = "sinophile_session";
export const SESSION_DAYS = 180;

/** New random session token and the id under which it is stored. */
export function newSessionToken(): { token: string; id: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, id: sessionId(token) };
}

export const sessionId = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Cookie attributes for the session (pass maxAge 0 to delete it). */
export const sessionCookie = (value: string, maxAgeSeconds = SESSION_DAYS * 86_400) => ({
  name: SESSION_COOKIE,
  value,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

/* ───────────── brute-force protection ───────────── */

export const MAX_FAILED_LOGINS = 10;
export const LOCK_MINUTES = 15;
