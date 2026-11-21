/**
 * End-to-end tests of the API route handlers against a throwaway MongoDB
 * (mongodb-memory-server downloads a mongod binary on the first run).
 */
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { NextRequest, type NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as account from "@/app/api/account/route";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as register from "@/app/api/auth/register/route";
import * as progress from "@/app/api/progress/route";
import * as settings from "@/app/api/settings/route";
import { emptyProgress, recordAnswer, type Progress } from "@/lib/progress/model";
import { MAX_FAILED_LOGINS, SESSION_COOKIE } from "./auth";
import { closeDatabase, getDatabase } from "./db";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "sinophile-test";
}, 180_000);

afterAll(async () => {
  await closeDatabase();
  await mongo?.stop();
});

type Handler = (request: NextRequest) => Promise<NextResponse>;

interface CallOptions {
  body?: unknown;
  cookie?: string;
  contentType?: string;
}

/** Calls a route handler like the browser would and returns status, JSON body and the session cookie it set. */
async function call(
  handler: Handler,
  method: string,
  { body, cookie, contentType = "application/json" }: CallOptions = {},
) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", `${SESSION_COOKIE}=${cookie}`);
  const response = await handler(
    new NextRequest("http://localhost/api", {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  const setCookie = response.cookies.get(SESSION_COOKIE);
  return {
    status: response.status,
    body: await response.json(),
    cookie: setCookie?.value,
    cookieMaxAge: setCookie?.maxAge,
  };
}

const practise = (ids: string[], day = "2026-11-04"): Progress =>
  ids.reduce((p, id) => recordAnswer(p, id, "meaning", true, 10, day), emptyProgress());

describe("accounts API", () => {
  let session = "";

  it("treats visitors without a session as guests", async () => {
    expect(await call(account.GET, "GET")).toMatchObject({ status: 200, body: { user: null } });
    expect((await call(account.GET, "GET", { cookie: "made-up" })).cookieMaxAge).toBe(0); // stale cookie removed
  });

  it("validates sign-up data", async () => {
    const bad = await call(register.POST, "POST", { body: { username: "a b", password: "12345678" } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/solo puede tener/);
    expect((await call(register.POST, "POST", { body: { username: "pablo", password: "1" } })).status).toBe(
      400,
    );
  });

  it("signs up, keeping the guest's progress and settings", async () => {
    const res = await call(register.POST, "POST", {
      body: {
        username: " Pablo ",
        password: "contraseña-segura",
        progress: practise(["ni", "wo"]),
        settings: { dailyGoal: 100, theme: "dark", hacked: true },
      },
    });
    expect(res.status).toBe(201);
    expect(res.cookie).toBeTruthy();
    session = res.cookie!;
    expect(res.body.user).toEqual({ username: "pablo" });
    expect(Object.keys(res.body.progress.items).sort()).toEqual(["ni:meaning", "wo:meaning"]);
    expect(res.body.settings).toMatchObject({ dailyGoal: 100, theme: "dark" });
    expect(res.body.settings).not.toHaveProperty("hacked");

    const user = await (await getDatabase()).users.findOne({ username: "pablo" });
    expect(user?.passwordHash).toMatch(/^scrypt\$/);
    expect(user?.passwordHash).not.toContain("contraseña");
  });

  it("refuses a username that is taken (case-insensitively)", async () => {
    const res = await call(register.POST, "POST", {
      body: { username: "PABLO", password: "otra-contraseña" },
    });
    expect(res.status).toBe(409);
  });

  it("returns the account with the session cookie", async () => {
    const res = await call(account.GET, "GET", { cookie: session });
    expect(res.body.user).toEqual({ username: "pablo" });
    expect(res.body.progress.days["2026-11-04"].xp).toBe(20);
  });

  it("merges progress changes, also when they arrive at the same time", async () => {
    const patches = ["ta-m", "ta-f", "women", "nimen", "tamen"].map((id) => practise([id], "2026-11-05"));
    const results = await Promise.all(
      patches.map((patch) => call(progress.POST, "POST", { cookie: session, body: { patch } })),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const items = (await call(account.GET, "GET", { cookie: session })).body.progress.items;
    expect(Object.keys(items).sort()).toEqual([
      "ni:meaning",
      "nimen:meaning",
      "ta-f:meaning",
      "ta-m:meaning",
      "tamen:meaning",
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

  it("saves settings", async () => {
    const res = await call(settings.PUT, "PUT", {
      cookie: session,
      body: { settings: { dailyGoal: 150, sessionLength: 20 } },
    });
    expect(res.body.settings).toMatchObject({ dailyGoal: 150, sessionLength: 20, theme: "auto" });
    expect((await call(account.GET, "GET", { cookie: session })).body.settings.dailyGoal).toBe(150);
  });

  it("signs out (the old session no longer works) and back in, merging guest progress", async () => {
    const out = await call(logout.POST, "POST", { cookie: session, body: {} });
    expect(out.cookieMaxAge).toBe(0);
    expect((await call(account.GET, "GET", { cookie: session })).body.user).toBeNull();

    expect((await call(login.POST, "POST", { body: { username: "pablo", password: "mal" } })).status).toBe(
      401,
    );
    expect(
      (await call(login.POST, "POST", { body: { username: "nadie", password: "contraseña-segura" } })).status,
    ).toBe(401);
    const res = await call(login.POST, "POST", {
      body: { username: "Pablo", password: "contraseña-segura", progress: practise(["ye"]) },
    });
    expect(res.status).toBe(200);
    session = res.cookie!;
    expect(res.body.progress.items).toHaveProperty("ye:meaning");
    expect(res.body.progress.items).toHaveProperty("ni:meaning");
    expect(res.body.settings.dailyGoal).toBe(150);
  });

  it("resets the progress", async () => {
    expect((await call(progress.DELETE, "DELETE", { cookie: session, body: {} })).status).toBe(200);
    expect((await call(account.GET, "GET", { cookie: session })).body.progress.items).toEqual({});
  });

  it("locks an account after too many wrong passwords", async () => {
    await call(register.POST, "POST", { body: { username: "victima", password: "correcta-123" } });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      expect(
        (await call(login.POST, "POST", { body: { username: "victima", password: `mal-${i}` } })).status,
      ).toBe(401);
    }
    const locked = await call(login.POST, "POST", {
      body: { username: "victima", password: "correcta-123" },
    });
    expect(locked.status).toBe(429);
  });

  it("deletes the account only with the right password", async () => {
    expect(
      (await call(account.DELETE, "DELETE", { cookie: session, body: { password: "mal" } })).status,
    ).toBe(403);
    const res = await call(account.DELETE, "DELETE", {
      cookie: session,
      body: { password: "contraseña-segura" },
    });
    expect(res.status).toBe(200);
    expect(res.cookieMaxAge).toBe(0);
    const db = await getDatabase();
    expect(await db.users.countDocuments({ username: "pablo" })).toBe(0);
    expect(await db.sessions.countDocuments({})).toBe(1); // only victima's sign-up session is left
    expect(
      (await call(login.POST, "POST", { body: { username: "pablo", password: "contraseña-segura" } })).status,
    ).toBe(401);
  });
});
