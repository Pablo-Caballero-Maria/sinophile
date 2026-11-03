"use client";
/**
 * Optional sync of progress with data/progress.json in the GitHub repo,
 * through the GitHub REST "contents" API and a fine-grained token stored only
 * on this device (Ajustes → Sincronización).
 *
 * pull → merge with local → push if anything changed. Commits that only touch
 * data/progress.json do not trigger a Vercel rebuild (see vercel.json).
 */
import type { SyncConfig } from "../settings";
import { mergeProgress, reviveProgress, type Progress } from "./model";

const API = "https://api.github.com";

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};
const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

function contentsUrl(c: SyncConfig) {
  const path = c.path.split("/").map(encodeURIComponent).join("/");
  return `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path}`;
}

const headers = (c: SyncConfig) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${c.token}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

export class SyncError extends Error {}

/** JSON with recursively sorted keys, to compare snapshots regardless of key order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );

async function explain(response: Response): Promise<never> {
  const hints: Record<number, string> = {
    401: "El token no es válido o ha caducado.",
    403: "El token no tiene permiso de escritura (Contents: Read and write).",
    404: "No encuentro el repositorio, la rama o el archivo. Revisa usuario/repo/rama.",
    409: "Conflicto con otro cambio simultáneo; vuelve a intentarlo.",
    422: "GitHub rechazó el cambio (¿rama protegida?).",
  };
  throw new SyncError(hints[response.status] ?? `GitHub respondió ${response.status}.`);
}

export async function pullProgress(c: SyncConfig): Promise<{ progress: Progress; sha: string | null }> {
  const response = await fetch(`${contentsUrl(c)}?ref=${encodeURIComponent(c.branch)}`, { headers: headers(c), cache: "no-store" });
  if (response.status === 404) return { progress: reviveProgress(null), sha: null };
  if (!response.ok) return explain(response);
  const body = (await response.json()) as { content: string; sha: string };
  return { progress: reviveProgress(JSON.parse(fromBase64(body.content))), sha: body.sha };
}

async function pushProgress(c: SyncConfig, progress: Progress, sha: string | null): Promise<Response> {
  return fetch(contentsUrl(c), {
    method: "PUT",
    headers: headers(c),
    body: JSON.stringify({
      message: `progress: sync ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      content: toBase64(JSON.stringify(progress, null, 1) + "\n"),
      branch: c.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

/** Two-way sync. Returns the merged progress (to store locally). Retries once on a conflict. */
export async function syncProgress(c: SyncConfig, local: Progress): Promise<Progress> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const remote = await pullProgress(c);
    const merged = mergeProgress(local, remote.progress);
    const sameData = canonical({ ...merged, updatedAt: "" }) === canonical({ ...remote.progress, updatedAt: "" });
    if (remote.sha && sameData) return merged; // nothing new to upload
    const response = await pushProgress(c, merged, remote.sha);
    if (response.ok) return merged;
    if (response.status !== 409 && response.status !== 422) return explain(response);
  }
  throw new SyncError("No se pudo sincronizar tras reintentar.");
}

/** Replaces the remote file without merging (used by "reset progress"). */
export async function overwriteRemote(c: SyncConfig, progress: Progress): Promise<void> {
  const { sha } = await pullProgress(c);
  const response = await pushProgress(c, progress, sha);
  if (!response.ok) await explain(response);
}

/** Quick check used by the settings form. */
export async function testConnection(c: SyncConfig): Promise<string> {
  const response = await fetch(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`, { headers: headers(c) });
  if (!response.ok) return explain(response);
  const repo = (await response.json()) as { full_name: string; permissions?: { push?: boolean } };
  if (repo.permissions && !repo.permissions.push) throw new SyncError("El token puede leer pero no escribir en el repositorio.");
  return repo.full_name;
}
