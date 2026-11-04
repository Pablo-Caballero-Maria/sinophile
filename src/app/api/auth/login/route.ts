/** POST /api/auth/login { username, password, progress? } → signs in (merging `progress` into the account). */
import type { NextRequest } from "next/server";
import { login } from "@/server/account";
import { sessionCookie } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readJson, route } from "@/server/http";

export const POST = route(async (request: NextRequest) => {
  const body = await readJson(request, 2_000_000); // may carry the guest's progress
  const { token, payload } = await login(await getDatabase(), body);
  const response = json(payload);
  response.cookies.set(sessionCookie(token));
  return response;
});
