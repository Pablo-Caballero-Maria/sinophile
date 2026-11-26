/**
 * POST   /api/progress { patch } → merges the changed part of the progress into the account.
 * DELETE /api/progress {}        → resets the account's progress.
 */
import type { NextRequest } from "next/server";
import { mergeIntoProgress, requireUser, resetProgress } from "@/server/account";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readBody, readJson, route } from "@/server/http";
import { reviveProgress } from "@/lib/progress/model";
import { z } from "@/lib/zod";

/** The changed part of the progress; reviveProgress then keeps only its well-formed values. */
const saveSchema = z.object({
  patch: z.record(z.string(), z.unknown(), { error: "Falta el progreso que guardar." }),
});

export const POST = route(async (request: NextRequest) => {
  const { patch } = await readBody(request, saveSchema, 2_000_000); // an imported backup can be large
  const db = await getDatabase();
  const user = await requireUser(await getAuth(), db, request.headers);
  await mergeIntoProgress(db, user._id, reviveProgress(patch));
  return json({ ok: true });
});

export const DELETE = route(async (request: NextRequest) => {
  await readJson(request);
  const db = await getDatabase();
  const user = await requireUser(await getAuth(), db, request.headers);
  await resetProgress(db, user._id);
  return json({ ok: true });
});
