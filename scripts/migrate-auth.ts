/**
 * Moves every account from before Better Auth (sinophile ≤ 1.1: collections `users` and `sessions`)
 * into Better Auth's collections, keeping ids (so progress stays linked) and passwords.
 *
 * Optional: the app moves each account by itself the first time it signs in (src/server/legacy.ts);
 * this does them all at once. Safe to run again (it moves only what is left).
 *
 *   npm run migrate:auth        # uses MONGODB_URI and MONGODB_DB from the environment or .env.local
 */
import { closeDatabase, getDatabase } from "../src/server/db.ts";
import { migrateAllLegacyUsers } from "../src/server/legacy.ts";

try {
  const moved = await migrateAllLegacyUsers(await getDatabase());
  console.log(
    moved.length
      ? `Cuentas migradas (${moved.length}): ${moved.join(", ")}`
      : "No quedan cuentas por migrar.",
  );
} finally {
  await closeDatabase();
}
