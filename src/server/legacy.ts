/**
 * Accounts from before Better Auth (sinophile ≤ 1.1: collections `users` and `sessions`), moved into
 * Better Auth's collections (server only).
 *
 * A legacy account is moved the first time someone signs in or signs up with its username (the
 * auth hooks call migrateLegacyUser), or all at once with `npm run migrate:auth`. It keeps its id,
 * so its progress (`progress._id`) stays linked, and its password hash, which passwords.ts still
 * verifies. Its old sessions can't become Better Auth sessions (only their SHA-256 was stored), so
 * they are deleted: those devices sign in once more.
 *
 * Each step is idempotent: an interrupted move (or two requests at once) finishes on the next call.
 */
import { MongoServerError } from "mongodb";
import { accountEmail } from "../lib/account/types.ts";
import type { Database, LegacyUserDoc } from "./db.ts";

const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === 11000;

async function moveUser(db: Database, legacy: LegacyUserDoc): Promise<void> {
  const now = new Date();
  try {
    await db.users.insertOne({
      _id: legacy._id,
      name: legacy.username,
      email: accountEmail(legacy.username),
      emailVerified: false,
      image: null,
      createdAt: legacy.createdAt,
      updatedAt: now,
      username: legacy.username,
      displayUsername: legacy.username,
      settings: legacy.settings,
      failedLogins: legacy.failedLogins,
      lockedUntil: legacy.lockedUntil,
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // Already moved (an earlier, interrupted call), unless another account took the name meanwhile.
    const existing = await db.users.findOne({ username: legacy.username }, { projection: { _id: 1 } });
    if (!existing?._id.equals(legacy._id))
      throw new Error(`No se pudo migrar la cuenta «${legacy.username}»: el nombre ya está en uso.`);
  }
  await db.accounts.updateOne(
    { userId: legacy._id, providerId: "credential" },
    {
      $setOnInsert: {
        accountId: legacy._id.toHexString(),
        password: legacy.passwordHash,
        createdAt: legacy.createdAt,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  await db.legacySessions.deleteMany({ userId: legacy._id });
  await db.legacyUsers.deleteOne({ _id: legacy._id });
}

/** Moves the legacy account with this (normalised) username, if there is one. True if it moved. */
export async function migrateLegacyUser(db: Database, username: string): Promise<boolean> {
  const legacy = await db.legacyUsers.findOne({ username });
  if (!legacy) return false;
  await moveUser(db, legacy);
  return true;
}

/** Moves every legacy account; returns the usernames moved. */
export async function migrateAllLegacyUsers(db: Database): Promise<string[]> {
  const moved: string[] = [];
  for await (const legacy of db.legacyUsers.find()) {
    await moveUser(db, legacy);
    moved.push(legacy.username);
  }
  // Sessions of accounts that no longer exist.
  await db.legacySessions.deleteMany({});
  return moved;
}
