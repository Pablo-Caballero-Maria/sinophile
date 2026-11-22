/**
 * /api/auth/* → Better Auth (src/server/auth.ts): sign up, sign in by username, sign out, the
 * session, deleting the account… The client calls it through src/lib/account/auth-client.ts.
 */
import { getAuth } from "@/server/auth";

const handle = async (request: Request): Promise<Response> => (await getAuth()).handler(request);

export const GET = handle;
export const POST = handle;
