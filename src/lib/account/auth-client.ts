/**
 * Better Auth's client (src/server/auth.ts is the server): sign up, sign in by username, sign out
 * and delete the account, against /api/auth/* on this same origin. The session is Better Auth's
 * HttpOnly cookie. Failures become ApiErrors with a Spanish message, like the rest of the API.
 */
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { ApiError } from "./api";
import { accountEmail, normalizeUsername, type Credentials } from "./types";

export const authClient = createAuthClient({ plugins: [usernameClient()] });

/** Spanish messages for Better Auth's error codes (the ones these calls can return). */
const MESSAGES: Record<string, string> = {
  INVALID_USERNAME_OR_PASSWORD: "Usuario o contraseña incorrectos.",
  INVALID_PASSWORD: "La contraseña no es correcta.",
  USERNAME_IS_ALREADY_TAKEN: "Ese nombre de usuario ya existe. Elige otro.",
  USER_ALREADY_EXISTS: "Ese nombre de usuario ya existe. Elige otro.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ese nombre de usuario ya existe. Elige otro.",
  USERNAME_TOO_SHORT: "El nombre de usuario es demasiado corto.",
  USERNAME_TOO_LONG: "El nombre de usuario es demasiado largo.",
  INVALID_USERNAME: "El nombre de usuario solo puede tener letras sin tildes, números, «.», «-» y «_».",
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  ACCOUNT_LOCKED: "Demasiados intentos fallidos. Espera unos minutos y vuelve a probarlo.",
};

interface AuthFailure {
  status: number;
  code?: string | undefined;
}

/** The Spanish message for a Better Auth error. */
export function authErrorMessage({ status, code }: AuthFailure): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status === 0) return "No hay conexión con el servidor.";
  if (status === 429) return "Demasiados intentos. Espera un momento y vuelve a probarlo.";
  return `El servidor respondió ${status}.`;
}

/** Runs a Better Auth call; its `{ error }` (or a network failure) becomes an ApiError. */
async function run(call: () => Promise<{ error: AuthFailure | null }>): Promise<void> {
  let result: { error: AuthFailure | null };
  try {
    result = await call();
  } catch {
    throw new ApiError(0, authErrorMessage({ status: 0 }));
  }
  if (result.error) throw new ApiError(result.error.status, authErrorMessage(result.error));
}

export const auth = {
  signUp: ({ username, password }: Credentials) => {
    const name = normalizeUsername(username);
    // The server derives name and e-mail from the username too (accountEmail); they're sent
    // because Better Auth's sign-up requires them.
    return run(() => authClient.signUp.email({ username: name, name, email: accountEmail(name), password }));
  },
  signIn: ({ username, password }: Credentials) =>
    run(() => authClient.signIn.username({ username: normalizeUsername(username), password })),
  signOut: () => run(() => authClient.signOut()),
  deleteAccount: (password: string) => run(() => authClient.deleteUser({ password })),
};
