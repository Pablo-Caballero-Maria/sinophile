/**
 * MongoDB Atlas access (server only).
 *
 * Configuration (environment variables; locally in .env.local, in Vercel as
 * project environment variables):
 *   MONGODB_URI  connection string of the cluster (secret)
 *   MONGODB_DB   database name (default "sinophile")
 *
 * Collections:
 *   users     one document per account (credentials + settings)
 *   sessions  sign-in sessions; `_id` is the SHA-256 of the cookie token, expired ones are removed by a TTL index
 *   progress  one document per account (`_id` = user id) with the learner's Progress
 *
 * The client is created once per server instance and reused across requests.
 */
import { MongoClient, type Collection, type ObjectId } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import type { Progress } from "../lib/progress/model.ts";
import type { Settings } from "../lib/settings/model.ts";

export interface UserDoc {
  _id: ObjectId;
  /** Normalised (lowercase), unique. */
  username: string;
  /** See auth.ts → hashPassword. */
  passwordHash: string;
  settings: Settings;
  createdAt: Date;
  /** Consecutive failed sign-ins (reset on success / lock). */
  failedLogins: number;
  /** Sign-in is refused until this moment after too many failures. */
  lockedUntil: Date | null;
}

export interface SessionDoc {
  /** SHA-256 (hex) of the token stored in the cookie: a database leak does not leak usable tokens. */
  _id: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

export interface ProgressDoc {
  /** Same as the user's _id. */
  _id: ObjectId;
  /** Revision, incremented on every write (optimistic concurrency). */
  rev: number;
  progress: Progress;
  updatedAt: Date;
}

export interface Database {
  client: MongoClient;
  users: Collection<UserDoc>;
  sessions: Collection<SessionDoc>;
  progress: Collection<ProgressDoc>;
}

async function connect(): Promise<Database> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta la variable de entorno MONGODB_URI.");
  const client = new MongoClient(uri, {
    appName: "sinophile",
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    maxIdleTimeMS: 60_000,
  });
  // On Vercel, keeps the function alive just long enough to close idle connections (no-op elsewhere).
  attachDatabasePool(client);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "sinophile");
  const database: Database = {
    client,
    users: db.collection<UserDoc>("users"),
    sessions: db.collection<SessionDoc>("sessions"),
    progress: db.collection<ProgressDoc>("progress"),
  };
  await Promise.all([
    database.users.createIndex({ username: 1 }, { unique: true }),
    database.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.sessions.createIndex({ userId: 1 }),
  ]);
  return database;
}

// Cached on globalThis so that `next dev` hot reloads don't open a new pool each time.
const cache = globalThis as typeof globalThis & { __sinophileDb?: Promise<Database> };

/** Connected collections (connects and creates the indexes on first use). */
export function getDatabase(): Promise<Database> {
  cache.__sinophileDb ??= connect().catch((error) => {
    cache.__sinophileDb = undefined; // retry on the next request
    throw error;
  });
  return cache.__sinophileDb;
}

/** Closes the connection (tests). */
export async function closeDatabase(): Promise<void> {
  const pending = cache.__sinophileDb;
  cache.__sinophileDb = undefined;
  if (pending) await (await pending).client.close();
}
