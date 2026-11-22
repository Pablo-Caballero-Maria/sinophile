/**
 * Locks an account for a while after too many wrong passwords in a row (server only).
 *
 * Better Auth's rate limit counts requests per IP address; this counts failures per account, so
 * guessing a password from many addresses is stopped too. Both run on `/sign-in/username` (see the
 * hooks in auth.ts); the counters live on the account (`user.failedLogins`, `user.lockedUntil`).
 */
import type { Database } from "./db.ts";

export const MAX_FAILED_LOGINS = 10;
export const LOCK_MINUTES = 15;

/** True while the account with this username is locked. */
export async function isLocked(db: Database, username: string, now = new Date()): Promise<boolean> {
  const user = await db.users.findOne({ username }, { projection: { lockedUntil: 1 } });
  return Boolean(user?.lockedUntil && user.lockedUntil > now);
}

/** Counts a sign-in attempt: a success clears the counter; the MAX_FAILED_LOGINS-th failure locks. */
export async function recordSignIn(db: Database, username: string, succeeded: boolean): Promise<void> {
  if (succeeded) {
    await db.users.updateOne(
      { username, $or: [{ failedLogins: { $gt: 0 } }, { lockedUntil: { $ne: null } }] },
      { $set: { failedLogins: 0, lockedUntil: null } },
    );
    return;
  }
  const after = await db.users.findOneAndUpdate(
    { username },
    { $inc: { failedLogins: 1 } },
    { returnDocument: "after", projection: { failedLogins: 1 } },
  );
  if (after && (after.failedLogins ?? 0) >= MAX_FAILED_LOGINS) {
    await db.users.updateOne(
      { _id: after._id },
      { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } },
    );
  }
}
