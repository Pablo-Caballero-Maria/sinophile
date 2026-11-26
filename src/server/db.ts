/**
 * MongoDB Atlas access (server only), with every collection typed.
 *
 * Configuration (environment variables; locally in .env.local, in Vercel as
 * project environment variables):
 *   MONGODB_URI  connection string of the cluster (secret)
 *   MONGODB_DB   database name (default "sinophile")
 *
 * Collections:
 *   user, account, session, rateLimit  Better Auth's (src/server/auth.ts): the account, its
 *                                      password hash, sign-in sessions and sign-in rate limits.
 *                                      Only `user` is touched here, for the fields sinophile adds
 *                                      (settings and the lock after failed sign-ins).
 *   progress                           one document per account (`_id` = user id) with the learner's Progress
 *   users, sessions                    accounts from before Better Auth (v1.1 and earlier), moved
 *                                      into Better Auth's collections on first use (legacy.ts)
 *
 * The client is created once per server instance and reused across requests.
 */
import { MongoClient, type Collection, type Db, type ObjectId } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import type { Progress } from "../lib/progress/model.ts";
import type { Settings } from "../lib/settings/model.ts";
import { serverEnv } from "./env.ts";

/** Better Auth's `user` collection: its own fields plus the ones declared in auth.ts (additionalFields). */
export interface AuthUserDoc {
  _id: ObjectId;
  name: string;
  /** Not a real address: sinophile accounts have none (see accountEmail). */
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Normalised (lowercase), unique: the username plugin's field. */
  username: string;
  displayUsername?: string;
  settings?: Settings;
  /** Consecutive failed sign-ins (reset on success / lock). */
  failedLogins?: number;
  /** Sign-in is refused until this moment after too many failures. */
  lockedUntil?: Date | null;
}

/** Better Auth's `account` collection (only the fields the legacy migration writes). */
export interface AuthAccountDoc {
  _id: ObjectId;
  userId: ObjectId;
  accountId: string;
  providerId: "credential";
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressDoc {
  /** Same as the user's _id. */
  _id: ObjectId;
  /** Revision, incremented on every write (optimistic concurrency). */
  rev: number;
  progress: Progress;
  updatedAt: Date;
}

/** An account from before Better Auth (collection `users`). */
export interface LegacyUserDoc {
  _id: ObjectId;
  username: string;
  /** "scrypt$N$r$p$<salt>$<hash>", see passwords.ts. */
  passwordHash: string;
  settings: Settings;
  createdAt: Date;
  failedLogins: number;
  lockedUntil: Date | null;
}

/** A session from before Better Auth (collection `sessions`): only deleted now. */
export interface LegacySessionDoc {
  _id: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

export interface Database {
  client: MongoClient;
  db: Db;
  /** Multi-document transactions need a replica set (Atlas is one; a lone local mongod isn't). */
  transactions: boolean;
  users: Collection<AuthUserDoc>;
  accounts: Collection<AuthAccountDoc>;
  progress: Collection<ProgressDoc>;
  legacyUsers: Collection<LegacyUserDoc>;
  legacySessions: Collection<LegacySessionDoc>;
}

async function connect(): Promise<Database> {
  const env = serverEnv();
  const client = new MongoClient(env.MONGODB_URI, {
    appName: "sinophile",
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    maxIdleTimeMS: 60_000,
  });
  // On Vercel, keeps the function alive just long enough to close idle connections (no-op elsewhere).
  attachDatabasePool(client);
  await client.connect();
  const db = client.db(env.MONGODB_DB);
  const hello = await db.admin().command({ hello: 1 });
  const database: Database = {
    client,
    db,
    transactions: typeof hello.setName === "string",
    users: db.collection<AuthUserDoc>("user"),
    accounts: db.collection<AuthAccountDoc>("account"),
    progress: db.collection<ProgressDoc>("progress"),
    legacyUsers: db.collection<LegacyUserDoc>("users"),
    legacySessions: db.collection<LegacySessionDoc>("sessions"),
  };
  // Better Auth's adapter doesn't create indexes on MongoDB: these are the ones its queries need.
  await Promise.all([
    database.users.createIndex({ username: 1 }, { unique: true }),
    database.users.createIndex({ email: 1 }, { unique: true }),
    database.accounts.createIndex({ userId: 1 }),
    db.collection("session").createIndex({ token: 1 }, { unique: true }),
    db.collection("session").createIndex({ userId: 1 }),
    db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("rateLimit").createIndex({ key: 1 }, { unique: true }),
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
