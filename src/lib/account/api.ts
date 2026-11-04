/**
 * Typed calls to the app's API (src/app/api/**). Every request is JSON
 * (the server requires it: CSRF defence) and errors carry the server's
 * Spanish message.
 */
import type { Progress } from "../progress/model";
import type { Settings } from "../settings/model";
import type { AccountPayload } from "./types";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body: unknown = {}, keepalive = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      keepalive,
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor.");
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new ApiError(response.status, data?.error ?? `El servidor respondió ${response.status}.`);
  return data as T;
}

export interface Credentials {
  username: string;
  password: string;
}

export const api = {
  account: () => request<AccountPayload>("GET", "/api/account"),
  register: (body: Credentials & { progress?: Progress; settings?: Settings }) => request<AccountPayload>("POST", "/api/auth/register", body),
  login: (body: Credentials & { progress?: Progress }) => request<AccountPayload>("POST", "/api/auth/login", body),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout"),
  deleteAccount: (password: string) => request<{ ok: true }>("DELETE", "/api/account", { password }),
  saveProgress: (patch: Progress, keepalive = false) => request<{ ok: true }>("POST", "/api/progress", { patch }, keepalive),
  resetProgress: () => request<{ ok: true }>("DELETE", "/api/progress"),
  saveSettings: (settings: Settings, keepalive = false) => request<{ settings: Settings }>("PUT", "/api/settings", { settings }, keepalive),
};
