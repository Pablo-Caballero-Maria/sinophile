import { describe, expect, it } from "vitest";
import { OFFLINE_FALLBACK, OFFLINE_PAGES } from "./pages";
import { isApi, isDictionary, isDocument, isPage, type RequestInfo } from "./requests";

const info = (path: string, mode = "cors", destination = "", sameOrigin = true): RequestInfo => ({
  url: new URL(path, "https://sinophile.vercel.app"),
  request: { mode: mode as RequestMode, destination: destination as RequestDestination },
  sameOrigin,
});

describe("service worker routing", () => {
  it("never caches the API (accounts, progress, Better Auth)", () => {
    expect(isApi(info("/api/account"))).toBe(true);
    expect(isApi(info("/api/auth/get-session"))).toBe(true);
    expect(isApi(info("/apis"))).toBe(false);
    expect(isApi(info("/api/account", "cors", "", false))).toBe(false);
  });

  it("treats navigations as pages, whatever their parameters", () => {
    expect(isPage(info("/leccion?id=3", "navigate", "document"))).toBe(true);
    expect(isPage(info("/_next/static/chunks/a.js", "no-cors", "script"))).toBe(false);
    expect(isPage(info("/", "navigate", "document", false))).toBe(false);
  });

  it("keeps the dictionary apart, and falls back only for documents", () => {
    expect(isDictionary(info("/data/cedict.json"))).toBe(true);
    expect(isDictionary(info("/data/exercises.json"))).toBe(false);
    expect(isDocument(info("/x", "navigate", "document"))).toBe(true);
    expect(isDocument(info("/x.png", "no-cors", "image"))).toBe(false);
  });

  it("downloads every page of the app at install", () => {
    expect(OFFLINE_PAGES).toContain("/");
    expect(OFFLINE_PAGES).toContain("/sesion");
    expect(OFFLINE_PAGES).not.toContain(OFFLINE_FALLBACK);
  });
});
