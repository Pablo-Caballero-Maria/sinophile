/** GET /api/account → { user: null } for guests, or { user, progress, settings } (session: Better Auth's cookie). */
import type { NextRequest } from "next/server";
import { accountPayload, currentUser } from "@/server/account";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, route } from "@/server/http";

export const GET = route(async (request: NextRequest) => {
  const db = await getDatabase();
  const user = await currentUser(await getAuth(), db, request.headers);
  return json(user ? await accountPayload(db, user) : { user: null });
});
