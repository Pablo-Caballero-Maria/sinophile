/** PUT /api/settings { settings } → replaces the account's preferences. */
import type { NextRequest } from "next/server";
import { requireUser, saveSettings } from "@/server/account";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { json, readBody, route } from "@/server/http";
import { z } from "@/lib/zod";

/** The preferences; sanitizeSettings then keeps only the known, well-typed ones. */
const saveSchema = z.object({
  settings: z.record(z.string(), z.unknown(), { error: "Faltan los ajustes que guardar." }),
});

export const PUT = route(async (request: NextRequest) => {
  const { settings } = await readBody(request, saveSchema);
  const db = await getDatabase();
  const user = await requireUser(await getAuth(), db, request.headers);
  return json({ settings: await saveSettings(db, user._id, settings) });
});
