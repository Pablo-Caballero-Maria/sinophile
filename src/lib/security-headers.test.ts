import { describe, expect, it } from "vitest";

import {
  VERCEL_TOOLBAR,
  contentSecurityPolicy,
  deploymentOptions,
  mergePolicies,
  permissionsPolicy,
  securityHeaders,
} from "./security-headers";

/** The CSP as { directive: sources }. */
function parse(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name!, sources];
    }),
  );
}

describe("contentSecurityPolicy", () => {
  it("only lets the page load from and talk to this site", () => {
    const csp = parse(contentSecurityPolicy());
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp["connect-src"]).toEqual(["'self'"]);
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    expect(parse(contentSecurityPolicy({ dev: true }))["script-src"]).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy()).not.toContain("unsafe-eval");
  });

  it("lets Vercel's toolbar in on preview deployments only", () => {
    const preview = parse(contentSecurityPolicy({ preview: true }));
    expect(preview["script-src"]).toContain("https://vercel.live");
    expect(preview["frame-src"]).toEqual(["'self'", "https://vercel.live"]);
    expect(contentSecurityPolicy()).not.toContain("vercel.live");
  });

  it("upgrades plain-http requests when served over HTTPS", () => {
    expect(contentSecurityPolicy({ https: true }).endsWith("; upgrade-insecure-requests")).toBe(true);
  });

  it("adds extra sources without repeating any", () => {
    const csp = parse(contentSecurityPolicy({ extra: { "connect-src": ["'self'", "https://example.org"] } }));
    expect(csp["connect-src"]).toEqual(["'self'", "https://example.org"]);
  });
});

describe("mergePolicies", () => {
  it("keeps each source once, in order", () => {
    expect(mergePolicies({ "img-src": ["a", "b"] }, { "img-src": ["b", "c"], "font-src": ["d"] })).toEqual({
      "img-src": ["a", "b", "c"],
      "font-src": ["d"],
    });
    expect(mergePolicies(VERCEL_TOOLBAR)).toEqual(VERCEL_TOOLBAR);
  });
});

describe("securityHeaders", () => {
  it("sends HSTS, nosniff, no framing, a strict referrer and no powerful features", () => {
    const headers = Object.fromEntries(securityHeaders().map(({ key, value }) => [key, value]));
    expect(Object.keys(headers)).toEqual([
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]);
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });
});

describe("deploymentOptions", () => {
  it("reads Vercel's environment", () => {
    expect(deploymentOptions({ VERCEL: "1", VERCEL_ENV: "preview" })).toEqual({ preview: true, https: true });
    expect(deploymentOptions({ VERCEL: "1", VERCEL_ENV: "production" })).toEqual({
      preview: false,
      https: true,
    });
    expect(deploymentOptions({})).toEqual({ preview: false, https: false });
  });
});

describe("permissionsPolicy", () => {
  it("allows only the features the site uses, and only for itself", () => {
    expect(permissionsPolicy()).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    );
    expect(permissionsPolicy(["microphone"])).toContain("microphone=(self)");
    expect(permissionsPolicy(["microphone"])).toContain("camera=()");
    expect(
      securityHeaders({ allow: ["microphone"] }).find((h) => h.key === "Permissions-Policy")!.value,
    ).toContain("microphone=(self)");
  });
});
