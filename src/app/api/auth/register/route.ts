/** POST /api/auth/register { username, password, progress?, settings? } → creates the account and signs in. */
import type { NextRequest } from "next/server";
import { register } from "@/server/account";
import { sessionCookie } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readJson, route } from "@/server/http";

export const POST = route(async (request: NextRequest) => {
  const body = await readJson(request, 2_000_000); // may carry the guest's progress
  const { token, payload } = await register(await getDatabase(), body);
  const response = json(payload, { status: 201 });
  response.cookies.set(sessionCookie(token));
  return response;
});
