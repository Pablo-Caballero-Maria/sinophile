/**
 * Account operations used by the API route handlers (server only). Each takes
 * the connected Database so it can be tested against a throwaway MongoDB.
 * Inputs are untrusted JSON; errors meant for the user are HttpErrors.
 */
import { MongoServerError, ObjectId } from "mongodb";
import { credentialsError, normalizeUsername, type AccountPayload } from "../lib/account/types.ts";
import { emptyProgress, mergeProgress, reviveProgress, type Progress } from "../lib/progress/model.ts";
import { sanitizeSettings, type Settings } from "../lib/settings/model.ts";
import {
  DUMMY_HASH,
  hashPassword,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  newSessionToken,
  SESSION_DAYS,
  sessionId,
  verifyPassword,
} from "./auth.ts";
import type { Database, UserDoc } from "./db.ts";
import { HttpError } from "./http.ts";

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === 11000;
const WRONG_CREDENTIALS = "Usuario o contraseña incorrectos.";

export interface SignedIn {
  /** Session token for the cookie. */
  token: string;
  payload: AccountPayload;
}

/* ───────────── sessions ───────────── */

async function createSession(db: Database, userId: ObjectId): Promise<string> {
  const { token, id } = newSessionToken();
  const now = new Date();
  await db.sessions.insertOne({
    _id: id,
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

/** The signed-in user, or null for guests and expired/unknown sessions. */
export async function userFromSession(db: Database, token: string | undefined): Promise<UserDoc | null> {
  if (!token) return null;
  const session = await db.sessions.findOne({ _id: sessionId(token) });
  // The TTL index removes expired sessions only every ~60 s, so check the date too.
  if (!session || session.expiresAt <= new Date()) return null;
  return db.users.findOne({ _id: session.userId });
}

export async function requireUser(db: Database, token: string | undefined): Promise<UserDoc> {
  const user = await userFromSession(db, token);
  if (!user) throw new HttpError(401, "Tu sesión ha caducado. Vuelve a iniciar sesión.");
  return user;
}

export async function endSession(db: Database, token: string | undefined): Promise<void> {
  if (token) await db.sessions.deleteOne({ _id: sessionId(token) });
}

/* ───────────── sign up / sign in ───────────── */

/** Creates an account. `progress`/`settings` (optional) carry over what the guest did before signing up. */
export async function register(db: Database, body: Record<string, unknown>): Promise<SignedIn> {
  const username = normalizeUsername(text(body.username));
  const password = text(body.password);
  const problem = credentialsError(username, password);
  if (problem) throw new HttpError(400, problem);

  const now = new Date();
  const user: UserDoc = {
    _id: new ObjectId(),
    username,
    passwordHash: await hashPassword(password),
    settings: sanitizeSettings(body.settings),
    createdAt: now,
    failedLogins: 0,
    lockedUntil: null,
  };
  try {
    await db.users.insertOne(user);
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(409, "Ese nombre de usuario ya existe. Elige otro.");
    throw error;
  }
  const progress = body.progress === undefined ? emptyProgress() : reviveProgress(body.progress);
  await db.progress.insertOne({ _id: user._id, rev: 1, progress, updatedAt: now });
  const token = await createSession(db, user._id);
  return { token, payload: { user: { username }, progress, settings: user.settings } };
}

/**
 * Signs in. After MAX_FAILED_LOGINS wrong passwords in a row the account is
 * locked for LOCK_MINUTES. `progress` (optional) is merged into the account.
 */
export async function login(db: Database, body: Record<string, unknown>): Promise<SignedIn> {
  const username = normalizeUsername(text(body.username));
  const password = text(body.password);
  const user = await db.users.findOne({ username });
  if (!user) {
    await verifyPassword(password, DUMMY_HASH); // same timing as a wrong password
    throw new HttpError(401, WRONG_CREDENTIALS);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, "Demasiados intentos fallidos. Espera unos minutos y vuelve a probarlo.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const after = await db.users.findOneAndUpdate(
      { _id: user._id },
      { $inc: { failedLogins: 1 } },
      { returnDocument: "after" },
    );
    if (after && after.failedLogins >= MAX_FAILED_LOGINS) {
      await db.users.updateOne(
        { _id: user._id },
        { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } },
      );
    }
    throw new HttpError(401, WRONG_CREDENTIALS);
  }
  if (user.failedLogins || user.lockedUntil)
    await db.users.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: null } });

  const progress =
    body.progress === undefined
      ? await loadProgress(db, user._id)
      : await mergeIntoProgress(db, user._id, reviveProgress(body.progress));
  const token = await createSession(db, user._id);
  return {
    token,
    payload: { user: { username: user.username }, progress, settings: sanitizeSettings(user.settings) },
  };
}

/** Everything the app needs after loading: user, progress and settings. */
export async function accountPayload(db: Database, user: UserDoc): Promise<AccountPayload> {
  return {
    user: { username: user.username },
    progress: await loadProgress(db, user._id),
    settings: sanitizeSettings(user.settings),
  };
}

/** Deletes the account and all its data. The password is asked again to avoid accidents. */
export async function deleteAccount(db: Database, user: UserDoc, password: unknown): Promise<void> {
  if (!(await verifyPassword(text(password), user.passwordHash)))
    throw new HttpError(403, "La contraseña no es correcta.");
  await db.progress.deleteOne({ _id: user._id });
  await db.sessions.deleteMany({ userId: user._id });
  await db.users.deleteOne({ _id: user._id });
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
  await db.users.updateOne({ _id: userId }, { $set: { settings } });
  return settings;
}
