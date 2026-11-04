/** POST /api/auth/logout → ends this device's session. */
import type { NextRequest } from "next/server";
import { endSession } from "@/server/account";
import { SESSION_COOKIE, sessionCookie } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readJson, route } from "@/server/http";

export const POST = route(async (request: NextRequest) => {
  await readJson(request);
  await endSession(await getDatabase(), request.cookies.get(SESSION_COOKIE)?.value);
  const response = json({ ok: true });
  response.cookies.set(sessionCookie("", 0));
  return response;
});
