/** PUT /api/settings { settings } → replaces the account's preferences. */
import type { NextRequest } from "next/server";
import { requireUser, saveSettings } from "@/server/account";
import { SESSION_COOKIE } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readJson, route } from "@/server/http";

export const PUT = route(async (request: NextRequest) => {
  const body = await readJson(request);
  const db = await getDatabase();
  const user = await requireUser(db, request.cookies.get(SESSION_COOKIE)?.value);
  return json({ settings: await saveSettings(db, user._id, body.settings) });
});
