/**
 * Shapes and rules shared by the browser and the API (src/app/api/**).
 * Pure: no browser or Node APIs.
 */
import type { Progress } from "../progress/model.ts";
import type { Settings } from "../settings/model.ts";

export interface PublicUser {
  username: string;
}

/** GET /api/account and the answer of login/register. */
export interface AccountPayload {
  /** null = not signed in (guest). */
  user: PublicUser | null;
  progress?: Progress;
  settings?: Settings;
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
const USERNAME_RE = /^[a-z0-9._-]+$/;

/** Usernames are case-insensitive: "Pablo " and "pablo" are the same account. */
export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase();

/** Spanish error message for invalid credentials, or null when they are acceptable. */
export function credentialsError(username: string, password: string): string | null {
  const name = normalizeUsername(username);
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX)
    return `El nombre de usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`;
  if (!USERNAME_RE.test(name)) return "El nombre de usuario solo puede tener letras sin tildes, números, «.», «-» y «_».";
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return "La contraseña es demasiado larga.";
  return null;
}
