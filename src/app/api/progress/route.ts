/**
 * POST   /api/progress { patch } → merges the changed part of the progress into the account.
 * DELETE /api/progress {}        → resets the account's progress.
 */
import type { NextRequest } from "next/server";
import { mergeIntoProgress, requireUser, resetProgress } from "@/server/account";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readJson, route } from "@/server/http";
import { reviveProgress } from "@/lib/progress/model";

export const POST = route(async (request: NextRequest) => {
  const body = await readJson(request, 2_000_000); // an imported backup can be large
  const db = await getDatabase();
  const user = await requireUser(await getAuth(), db, request.headers);
  await mergeIntoProgress(db, user._id, reviveProgress(body.patch));
  return json({ ok: true });
});

export const DELETE = route(async (request: NextRequest) => {
  await readJson(request);
  const db = await getDatabase();
  const user = await requireUser(await getAuth(), db, request.headers);
  await resetProgress(db, user._id);
  return json({ ok: true });
});
