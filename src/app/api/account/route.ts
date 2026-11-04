/**
 * GET    /api/account  → { user: null } for guests, or { user, progress, settings }.
 * DELETE /api/account  { password } → deletes the account and all its data.
 */
import type { NextRequest } from "next/server";
import { accountPayload, deleteAccount, requireUser, userFromSession } from "@/server/account";
import { SESSION_COOKIE, sessionCookie } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readJson, route } from "@/server/http";

export const GET = route(async (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const db = await getDatabase();
  const user = await userFromSession(db, token);
  if (!user) {
    const response = json({ user: null });
    if (token) response.cookies.set(sessionCookie("", 0)); // stale cookie
    return response;
  }
  return json(await accountPayload(db, user));
});

export const DELETE = route(async (request: NextRequest) => {
  const body = await readJson(request);
  const db = await getDatabase();
  const user = await requireUser(db, request.cookies.get(SESSION_COOKIE)?.value);
  await deleteAccount(db, user, body.password);
  const response = json({ ok: true });
  response.cookies.set(sessionCookie("", 0));
  return response;
});
