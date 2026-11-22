/**
 * The build's revision, for precached files whose URL doesn't change between builds (the offline
 * page): the commit Vercel builds, else the local git commit, else a random one (always fresh).
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export function buildRevision(env: Readonly<Record<string, string | undefined>> = process.env): string {
  if (env.VERCEL_GIT_COMMIT_SHA) return env.VERCEL_GIT_COMMIT_SHA;
  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  return (git.status === 0 && git.stdout.trim()) || randomUUID();
}
