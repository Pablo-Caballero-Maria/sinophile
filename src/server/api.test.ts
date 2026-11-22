/**
 * End-to-end tests of the API against a throwaway MongoDB (mongodb-memory-server downloads a mongod
 * binary on the first run): Better Auth's endpoints (/api/auth/*, through the same handler as
 * src/app/api/auth/[...all]/route.ts), the app's own route handlers, and the move of accounts from
 * before Better Auth.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { ObjectId } from "mongodb";
import { NextRequest, type NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as account from "@/app/api/account/route";
import * as authRoute from "@/app/api/auth/[...all]/route";
import * as progress from "@/app/api/progress/route";
import * as settings from "@/app/api/settings/route";
import { emptyProgress, recordAnswer, type Progress } from "@/lib/progress/model";
import { DEFAULT_SETTINGS } from "@/lib/settings/model";
import { AUTH_COOKIE_PREFIX } from "./auth";
import { closeDatabase, getDatabase } from "./db";
import { migrateAllLegacyUsers } from "./legacy";
import { MAX_FAILED_LOGINS } from "./lockout";

const ORIGIN = "http://localhost:3000";
const COOKIE = `${AUTH_COOKIE_PREFIX}.session_token`;

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "sinophile-test";
  process.env.BETTER_AUTH_SECRET = "a-test-secret-that-is-long-enough-for-better-auth";
}, 180_000);

afterAll(async () => {
  await closeDatabase();
  await mongo?.stop();
});

interface Reply {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON answers of several shapes
  body: any;
  /** The session cookie the response set ("" when it deleted it), if it set one. */
  cookie?: string;
}

async function reply(response: Response): Promise<Reply> {
  const set = response.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE}=`));
  const text = await response.text();
  const json = response.headers.get("content-type")?.includes("json");
  return {
    status: response.status,
    body: json && text ? JSON.parse(text) : text,
    cookie: set?.slice(COOKIE.length + 1).split(";")[0],
  };
}

/** A Better Auth endpoint, called like the browser's auth client does. */
async function auth(path: string, body: unknown, cookie?: string): Promise<Reply> {
  const headers = new Headers({ "content-type": "application/json", origin: ORIGIN });
  if (cookie) headers.set("cookie", `${COOKIE}=${cookie}`);
  const request = new Request(`${ORIGIN}/api/auth${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return reply(await authRoute.POST(request));
}

type Handler = (request: NextRequest) => Promise<NextResponse>;

/** One of the app's route handlers, with the session cookie. */
async function call(
  handler: Handler,
  method: string,
  {
    body,
    cookie,
    contentType = "application/json",
  }: { body?: unknown; cookie?: string; contentType?: string } = {},
): Promise<Reply> {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", `${COOKIE}=${cookie}`);
  return reply(
    await handler(
      new NextRequest(`${ORIGIN}/api`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    ),
  );
}

const signUp = (username: string, password: string, email = "ignored@example.com") =>
  auth("/sign-up/email", { username, name: username, email, password });
const signIn = (username: string, password: string) => auth("/sign-in/username", { username, password });

const practise = (ids: string[], day = "2026-11-04"): Progress =>
  ids.reduce((p, id) => recordAnswer(p, id, "meaning", true, 10, day), emptyProgress());

describe("accounts (Better Auth) and the account's data", () => {
  let session = "";

  it("treats visitors without a session as guests", async () => {
    expect(await call(account.GET, "GET")).toMatchObject({ status: 200, body: { user: null } });
    expect((await call(account.GET, "GET", { cookie: "made-up" })).body.user).toBeNull();
  });

  it("validates sign-up data", async () => {
    const bad = await signUp("a b", "12345678");
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("INVALID_USERNAME");
    expect((await signUp("pablo", "1")).body.code).toBe("PASSWORD_TOO_SHORT");
  });

  it("signs up with a normalised username, a derived e-mail and a hashed password", async () => {
    const res = await signUp(" Pablo ", "contraseña-segura");
    expect(res.status).toBe(200);
    expect(res.cookie).toBeTruthy();
    session = res.cookie!;
    expect(res.body.user).toMatchObject({ username: "pablo", email: "pablo@sinophile.invalid" });

    const db = await getDatabase();
    const user = await db.users.findOne({ username: "pablo" });
    expect(user?.email).toBe("pablo@sinophile.invalid");
    const credential = await db.accounts.findOne({ userId: user!._id });
    expect(credential?.providerId).toBe("credential");
    expect(credential?.password).not.toContain("contraseña");
  });

  it("refuses a username that is taken (case-insensitively)", async () => {
    const res = await signUp("PABLO", "otra-contraseña");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USERNAME_IS_ALREADY_TAKEN");
  });

  it("returns the new account, with empty progress and the default settings", async () => {
    const res = await call(account.GET, "GET", { cookie: session });
    expect(res.body).toEqual({
      user: { username: "pablo" },
      progress: emptyProgress(),
      settings: DEFAULT_SETTINGS,
    });
  });

  it("merges progress changes, also when they arrive at the same time", async () => {
    const patches = ["ni", "wo", "ta-m", "ta-f", "women"].map((id) => practise([id], "2026-11-05"));
    const results = await Promise.all(
      patches.map((patch) => call(progress.POST, "POST", { cookie: session, body: { patch } })),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const items = (await call(account.GET, "GET", { cookie: session })).body.progress.items;
    expect(Object.keys(items).sort()).toEqual([
      "ni:meaning",
      "ta-f:meaning",
      "ta-m:meaning",
      "wo:meaning",
      "women:meaning",
    ]);
  });

  it("drops unsafe keys from untrusted progress", async () => {
    const patch = {
      days: { $where: { xp: 1 } },
      items: { "a.b:meaning": { b: 1, d: "2026-11-05", s: 1, c: 1, t: 1 } },
    };
    expect((await call(progress.POST, "POST", { cookie: session, body: { patch } })).status).toBe(200);
    const stored = await (await getDatabase()).progress.findOne({});
    expect(JSON.stringify(stored)).not.toContain("$where");
    expect(JSON.stringify(stored)).not.toContain("a.b");
  });

  it("requires a session and a JSON body for changes", async () => {
    expect((await call(progress.POST, "POST", { body: { patch: practise(["x"]) } })).status).toBe(401);
    expect(
      (await call(progress.POST, "POST", { cookie: session, body: { patch: {} }, contentType: "text/plain" }))
        .status,
    ).toBe(415);
  });

  it("saves settings (light theme unless dark is chosen)", async () => {
    const res = await call(settings.PUT, "PUT", {
      cookie: session,
      body: { settings: { dailyGoal: 150, sessionLength: 20, theme: "auto" } },
    });
    expect(res.body.settings).toMatchObject({ dailyGoal: 150, sessionLength: 20, theme: "light" });
    expect((await call(account.GET, "GET", { cookie: session })).body.settings.dailyGoal).toBe(150);
  });

  it("signs out (the old session no longer works) and back in", async () => {
    const out = await auth("/sign-out", {}, session);
    expect(out.status).toBe(200);
    expect(out.cookie).toBe("");
    expect((await call(account.GET, "GET", { cookie: session })).body.user).toBeNull();

    const wrong = await signIn("pablo", "mal-contraseña");
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe("INVALID_USERNAME_OR_PASSWORD");
    expect((await signIn("nadie", "contraseña-segura")).status).toBe(401);

    const res = await signIn("Pablo", "contraseña-segura");
    expect(res.status).toBe(200);
    session = res.cookie!;
    const payload = (await call(account.GET, "GET", { cookie: session })).body;
    expect(payload.progress.items).toHaveProperty("ni:meaning");
    expect(payload.settings.dailyGoal).toBe(150);
  });

  it("doesn't sign in by e-mail (sinophile accounts have no real address)", async () => {
    const res = await auth("/sign-in/email", {
      email: "pablo@sinophile.invalid",
      password: "contraseña-segura",
    });
    expect(res.status).toBe(404);
  });

  it("resets the progress", async () => {
    expect((await call(progress.DELETE, "DELETE", { cookie: session, body: {} })).status).toBe(200);
    expect((await call(account.GET, "GET", { cookie: session })).body.progress.items).toEqual({});
  });

  it("locks an account after too many wrong passwords, and a success resets the count", async () => {
    await signUp("victima", "correcta-123");
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++)
      expect((await signIn("victima", `mal-${i}`)).status).toBe(401);
    expect((await signIn("victima", "correcta-123")).status).toBe(200);
    const db = await getDatabase();
    expect((await db.users.findOne({ username: "victima" }))?.failedLogins).toBe(0);

    for (let i = 0; i < MAX_FAILED_LOGINS; i++)
      expect((await signIn("victima", `mal-${i}`)).status).toBe(401);
    const locked = await signIn("victima", "correcta-123");
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe("ACCOUNT_LOCKED");
  });

  it("deletes the account and its data only with the right password", async () => {
    const wrong = await auth("/delete-user", { password: "mal" }, session);
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("INVALID_PASSWORD");

    const db = await getDatabase();
    const user = await db.users.findOne({ username: "pablo" });
    const res = await auth("/delete-user", { password: "contraseña-segura" }, session);
    expect(res.status).toBe(200);
    expect(await db.users.countDocuments({ username: "pablo" })).toBe(0);
    expect(await db.accounts.countDocuments({ userId: user!._id })).toBe(0);
    expect(await db.progress.countDocuments({ _id: user!._id })).toBe(0);
    expect(await db.db.collection("session").countDocuments({ userId: user!._id })).toBe(0);
    expect((await signIn("pablo", "contraseña-segura")).status).toBe(401);
  });
});

/** A password hash as sinophile ≤ 1.1 stored it. */
async function legacyHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFC"), salt, 32);
  return ["scrypt", 16384, 8, 1, salt.toString("base64"), hash.toString("base64")].join("$");
}

async function insertLegacyAccount(username: string, password: string): Promise<ObjectId> {
  const db = await getDatabase();
  const _id = new ObjectId();
  await db.legacyUsers.insertOne({
    _id,
    username,
    passwordHash: await legacyHash(password),
    settings: { ...DEFAULT_SETTINGS, dailyGoal: 20 },
    createdAt: new Date("2026-11-01"),
    failedLogins: 2,
    lockedUntil: null,
  });
  await db.legacySessions.insertOne({
    _id: "a".repeat(64),
    userId: _id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  await db.progress.insertOne({ _id, rev: 3, progress: practise(["hao"]), updatedAt: new Date() });
  return _id;
}

describe("accounts from before Better Auth", () => {
  it("move over on their first sign-in, keeping id, password, settings and progress", async () => {
    const id = await insertLegacyAccount("maria", "su-contraseña-antigua");
    const res = await signIn("Maria", "su-contraseña-antigua");
    expect(res.status).toBe(200);

    const db = await getDatabase();
    const user = await db.users.findOne({ username: "maria" });
    expect(user?._id.equals(id)).toBe(true);
    expect(user?.settings?.dailyGoal).toBe(20);
    expect(await db.legacyUsers.countDocuments({ _id: id })).toBe(0);
    expect(await db.legacySessions.countDocuments({ userId: id })).toBe(0);
    expect((await db.accounts.findOne({ userId: id }))?.password).toMatch(/^scrypt\$/);

    const payload = (await call(account.GET, "GET", { cookie: res.cookie })).body;
    expect(payload.user).toEqual({ username: "maria" });
    expect(payload.progress.items).toHaveProperty("hao:meaning");
  });

  it("can't be taken by a new sign-up, and keep refusing a wrong password", async () => {
    await insertLegacyAccount("lucia", "la-buena-123");
    expect((await signUp("lucia", "otra-cualquiera")).body.code).toBe("USERNAME_IS_ALREADY_TAKEN");
    expect((await signIn("lucia", "la-mala-123")).status).toBe(401);
    expect((await signIn("lucia", "la-buena-123")).status).toBe(200);
  });

  it("all move at once with npm run migrate:auth", async () => {
    const id = await insertLegacyAccount("juan", "contraseña-de-juan");
    const db = await getDatabase();
    expect(await migrateAllLegacyUsers(db)).toEqual(["juan"]);
    expect(await migrateAllLegacyUsers(db)).toEqual([]);
    expect((await db.users.findOne({ _id: id }))?.username).toBe("juan");
    expect((await signIn("juan", "contraseña-de-juan")).status).toBe(200);
  });
});
