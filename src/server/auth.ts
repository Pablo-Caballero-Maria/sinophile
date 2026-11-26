/**
 * Accounts and sign-in sessions with Better Auth (server only), mounted at /api/auth/* by
 * src/app/api/auth/[...all]/route.ts.
 *
 * - Username + password (the username plugin): sinophile accounts have no e-mail address, so the
 *   one Better Auth requires is derived from the username (accountEmail) and signing in by e-mail
 *   is switched off.
 * - Data in MongoDB through Better Auth's adapter (collections user, account, session, rateLimit;
 *   see db.ts). Sessions last SESSION_DAYS and live in an HttpOnly cookie, the only thing the
 *   browser stores.
 * - Hooks around Better Auth's endpoints: accounts from before Better Auth are moved over on first
 *   use (legacy.ts) and an account is locked after too many wrong passwords (lockout.ts).
 * - Deleting the account (with its password) also deletes its progress.
 *
 * Environment: BETTER_AUTH_SECRET (signs the cookies; required in production), AUTH_RATE_LIMIT=off
 * turns Better Auth's per-IP rate limit off (the end-to-end tests sign in many times from one IP).
 */
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { username } from "better-auth/plugins";
import { ObjectId } from "mongodb";
import {
  accountEmail,
  normalizeUsername,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  usernameError,
} from "../lib/account/types.ts";
import { getDatabase, type Database } from "./db.ts";
import { migrateLegacyUser } from "./legacy.ts";
import { isLocked, recordSignIn } from "./lockout.ts";
import { passwordHasher } from "./passwords.ts";
import { serverEnv } from "./env.ts";

export const AUTH_COOKIE_PREFIX = "sinophile";
export const SESSION_DAYS = 180;

/** Better Auth's error code (and HTTP 429) for a locked account. */
export const ACCOUNT_LOCKED = "ACCOUNT_LOCKED";

const USERNAME_PATHS = new Set(["/sign-up/email", "/sign-in/username", "/is-username-available"]);

const usernameIn = (body: unknown): string => {
  const raw = (body as { username?: unknown } | undefined)?.username;
  return typeof raw === "string" ? normalizeUsername(raw) : "";
};

export function createAuth(database: Database) {
  return betterAuth({
    appName: "sinophile",
    // The production domain, its preview deployments and local servers (dev and end-to-end tests).
    baseURL: {
      allowedHosts: ["sinophile.vercel.app", "sinophile-*.vercel.app", "localhost:*", "127.0.0.1:*"],
      fallback: "https://sinophile.vercel.app",
    },
    database: mongodbAdapter(database.db, { client: database.client, transaction: database.transactions }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      autoSignIn: true,
      password: passwordHasher,
    },
    plugins: [
      username({
        minUsernameLength: USERNAME_MIN,
        maxUsernameLength: USERNAME_MAX,
        usernameNormalization: normalizeUsername,
        usernameValidator: (name) => usernameError(name) === null,
        validationOrder: { username: "post-normalization" },
      }),
    ],
    session: { expiresIn: SESSION_DAYS * 86_400, updateAge: 86_400 },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await database.progress.deleteOne({ _id: new ObjectId(user.id) });
        },
      },
    },
    // Only what the app uses: no e-mail sign-in, no profile or e-mail changes, no e-mails at all.
    disabledPaths: [
      "/sign-in/email",
      "/update-user",
      "/change-email",
      "/request-password-reset",
      "/reset-password",
      "/send-verification-email",
      "/verify-email",
    ],
    rateLimit: {
      storage: "database",
      ...(serverEnv().AUTH_RATE_LIMIT === "off" && { enabled: false }),
    },
    advanced: { cookiePrefix: AUTH_COOKIE_PREFIX },
    telemetry: { enabled: false },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!USERNAME_PATHS.has(ctx.path)) return;
        const name = usernameIn(ctx.body);
        if (!name) return;
        await migrateLegacyUser(database, name);
        if (ctx.path === "/sign-up/email") Object.assign(ctx.body, { name, email: accountEmail(name) });
        if (ctx.path === "/sign-in/username" && (await isLocked(database, name)))
          throw ctx.error("TOO_MANY_REQUESTS", {
            code: ACCOUNT_LOCKED,
            message: "Too many failed sign-ins: the account is locked for a while",
          });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/username") return;
        const name = usernameIn(ctx.body);
        const returned = ctx.context.returned;
        const failed = isAPIError(returned);
        if (name && (!failed || returned.statusCode === 401)) await recordSignIn(database, name, !failed);
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

// One Better Auth instance per database connection (tests reconnect to a fresh database).
const instances = new WeakMap<Database, Auth>();

/** The Better Auth instance, on the connected database. */
export async function getAuth(): Promise<Auth> {
  const database = await getDatabase();
  let auth = instances.get(database);
  if (!auth) instances.set(database, (auth = createAuth(database)));
  return auth;
}
