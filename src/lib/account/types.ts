/**
 * Shapes and rules shared by the browser, the API (src/app/api/**) and Better Auth's configuration
 * (src/server/auth.ts). Pure: no browser or Node APIs.
 */
import type { Progress } from "../progress/model.ts";
import type { Settings } from "../settings/model.ts";
import { z } from "../zod.ts";

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

export interface Credentials {
  username: string;
  password: string;
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
const USERNAME_RE = /^[a-z0-9._-]+$/;

/** Usernames are case-insensitive: "Pablo " and "pablo" are the same account. */
export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase();

const USERNAME_LENGTH = `El nombre de usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`;

/** A username, normalised; the messages are the ones the learner sees. */
export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(USERNAME_MIN, USERNAME_LENGTH)
      .max(USERNAME_MAX, USERNAME_LENGTH)
      .regex(
        USERNAME_RE,
        "El nombre de usuario solo puede tener letras sin tildes, números, «.», «-» y «_».",
      ),
  );

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, "La contraseña es demasiado larga.");

/** What a new account needs. */
export const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });

/** What the account form holds (`repeat` is only shown when creating an account). */
export interface AuthFormInput {
  username: string;
  password: string;
  repeat: string;
}

const onlyCredentials = ({ username, password }: { username: string; password: string }): Credentials => ({
  username,
  password,
});

/** Signing in: just not empty (the server says whether they're right). */
export const signInFormSchema: z.ZodType<Credentials, AuthFormInput> = z
  .object({
    username: z.string().trim().min(1, "Escribe tu nombre de usuario.").transform(normalizeUsername),
    password: z.string().min(1, "Escribe tu contraseña."),
    repeat: z.string(),
  })
  .transform(onlyCredentials);

/** Creating an account: valid credentials, the password typed twice. */
export const signUpFormSchema: z.ZodType<Credentials, AuthFormInput> = z
  .object({ username: usernameSchema, password: passwordSchema, repeat: z.string() })
  .refine((form) => form.password === form.repeat, {
    path: ["repeat"],
    error: "Las contraseñas no coinciden.",
  })
  .transform(onlyCredentials);

/** Deleting the account: the password, asked again to avoid accidents. */
export const deleteAccountSchema = z.object({ password: z.string().min(1, "Escribe tu contraseña.") });

const firstProblem = (result: { error?: z.ZodError }): string | null =>
  result.error?.issues[0]?.message ?? null;

/** Spanish error message for an invalid username, or null when it is acceptable. */
export const usernameError = (username: string): string | null =>
  firstProblem(usernameSchema.safeParse(username));

/** Spanish error message for invalid credentials, or null when they are acceptable. */
export const credentialsError = (username: string, password: string): string | null =>
  firstProblem(credentialsSchema.safeParse({ username, password }));

/**
 * The e-mail address Better Auth requires for every account. sinophile accounts have none, so it is
 * derived from the (unique) username, on the reserved `.invalid` domain: it can never receive mail.
 */
export const accountEmail = (username: string): string => `${normalizeUsername(username)}@sinophile.invalid`;
