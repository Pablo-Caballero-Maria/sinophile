/**
 * Account data used by the API route handlers (server only): who is signed in (Better Auth's
 * session) and the account's progress and settings. Each function takes the connected Database so
 * it can be tested against a throwaway MongoDB. Inputs are untrusted JSON; errors meant for the
 * user are HttpErrors.
 */
import { MongoServerError, ObjectId } from "mongodb";
import type { AccountPayload } from "../lib/account/types.ts";
import { emptyProgress, mergeProgress, reviveProgress, type Progress } from "../lib/progress/model.ts";
import { sanitizeSettings, type Settings } from "../lib/settings/model.ts";
import type { Auth } from "./auth.ts";
import type { AuthUserDoc, Database } from "./db.ts";
import { HttpError } from "./http.ts";

const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === 11000;

/* ───────────── who is signed in ───────────── */

/** The signed-in user (from Better Auth's session cookie), or null for guests and ended sessions. */
export async function currentUser(auth: Auth, db: Database, headers: Headers): Promise<AuthUserDoc | null> {
  const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session || !ObjectId.isValid(session.user.id)) return null;
  return db.users.findOne({ _id: new ObjectId(session.user.id) });
}

export async function requireUser(auth: Auth, db: Database, headers: Headers): Promise<AuthUserDoc> {
  const user = await currentUser(auth, db, headers);
  if (!user) throw new HttpError(401, "Tu sesión ha caducado. Vuelve a iniciar sesión.");
  return user;
}

/** Everything the app needs after loading: user, progress and settings. */
export async function accountPayload(db: Database, user: AuthUserDoc): Promise<AccountPayload> {
  return {
    user: { username: user.username },
    progress: await loadProgress(db, user._id),
    settings: sanitizeSettings(user.settings),
  };
}

/* ───────────── progress & settings ───────────── */

export async function loadProgress(db: Database, userId: ObjectId): Promise<Progress> {
  const doc = await db.progress.findOne({ _id: userId });
  return doc ? reviveProgress(doc.progress) : emptyProgress();
}

/**
 * Merges a (usually partial) progress into the stored one with mergeProgress,
 * so concurrent saves from several devices never lose work. Uses the `rev`
 * field for optimistic concurrency and retries if another write got in between.
 */
export async function mergeIntoProgress(db: Database, userId: ObjectId, patch: Progress): Promise<Progress> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = await db.progress.findOne({ _id: userId });
    const merged = mergeProgress(doc ? reviveProgress(doc.progress) : emptyProgress(), patch);
    const updatedAt = new Date();
    if (!doc) {
      try {
        await db.progress.insertOne({ _id: userId, rev: 1, progress: merged, updatedAt });
        return merged;
      } catch (error) {
        if (isDuplicateKey(error)) continue;
        throw error;
      }
    }
    const result = await db.progress.updateOne(
      { _id: userId, rev: doc.rev },
      { $set: { progress: merged, updatedAt }, $inc: { rev: 1 } },
    );
    if (result.matchedCount === 1) return merged;
  }
  throw new HttpError(409, "No se pudo guardar el progreso por un conflicto. Se volverá a intentar.");
}

/** Replaces the stored progress with an empty one ("Borrar todo mi progreso"). */
export async function resetProgress(db: Database, userId: ObjectId): Promise<void> {
  const progress = { ...emptyProgress(), updatedAt: new Date().toISOString() };
  await db.progress.updateOne(
    { _id: userId },
    { $set: { progress, updatedAt: new Date() }, $inc: { rev: 1 } },
    { upsert: true },
  );
}

export async function saveSettings(db: Database, userId: ObjectId, raw: unknown): Promise<Settings> {
  const settings = sanitizeSettings(raw);
  await db.users.updateOne({ _id: userId }, { $set: { settings, updatedAt: new Date() } });
  return settings;
}
