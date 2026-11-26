/**
 * The HTTP security headers of every response (next.config.ts → headers()).
 *
 * The Content Security Policy only lets the page load code, styles, fonts and images from this
 * same site and connect only back to it, so an injected tag can't pull a script from elsewhere or
 * send anything away; the page can't be framed (clickjacking) and forms can only post here.
 *
 * Scripts still allow 'unsafe-inline': the pages are prerendered at build time, and Next.js puts
 * the React Server Components payload in inline <script> tags that only a per-request nonce could
 * authorise, which would mean rendering every page on each request (no CDN, no offline copies).
 * Subresource Integrity doesn't help there: it only covers the external script files.
 */

export type Directive =
  | "default-src"
  | "script-src"
  | "style-src"
  | "img-src"
  | "font-src"
  | "connect-src"
  | "media-src"
  | "worker-src"
  | "manifest-src"
  | "frame-src"
  | "object-src"
  | "base-uri"
  | "form-action"
  | "frame-ancestors";

export type Policy = Partial<Record<Directive, readonly string[]>>;

export interface SecurityOptions {
  /** `next dev`: React needs eval() there for its debugging features. */
  dev?: boolean;
  /** A Vercel preview deployment, which shows Vercel's toolbar (vercel.live). */
  preview?: boolean;
  /** Served over HTTPS (on Vercel): plain-http subresources are upgraded. */
  https?: boolean;
  /** Extra sources for some directives, on top of the base policy. */
  extra?: Policy;
  /** Browser features this site itself uses (allowed for its own pages only). */
  allow?: readonly PermissionFeature[];
}

const BASE_POLICY: Policy = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  // React's style={…} attributes and next/font's inline @font-face rules.
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "media-src": ["'self'"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

/** What Vercel's toolbar (comments, previews' feedback) loads, from Vercel's CSP guide. */
export const VERCEL_TOOLBAR: Policy = {
  "script-src": ["https://vercel.live"],
  "style-src": ["https://vercel.live"],
  "img-src": ["https://vercel.live", "https://vercel.com"],
  "font-src": ["https://vercel.live", "https://assets.vercel.com"],
  "connect-src": ["https://vercel.live", "wss://ws-us3.pusher.com"],
  "frame-src": ["'self'", "https://vercel.live"],
};

/** Joins policies, keeping each source once per directive, in order. */
export function mergePolicies(...policies: Policy[]): Policy {
  const merged: Partial<Record<Directive, string[]>> = {};
  for (const policy of policies) {
    for (const [directive, sources] of Object.entries(policy) as [Directive, readonly string[]][]) {
      const list = (merged[directive] ??= []);
      for (const source of sources) if (!list.includes(source)) list.push(source);
    }
  }
  return merged;
}

/** The Content-Security-Policy header's value. */
export function contentSecurityPolicy({
  dev = false,
  preview = false,
  https = false,
  extra = {},
}: SecurityOptions = {}): string {
  const policy = mergePolicies(
    BASE_POLICY,
    dev ? { "script-src": ["'unsafe-eval'"] } : {},
    preview ? VERCEL_TOOLBAR : {},
    extra,
  );
  const directives = Object.entries(policy).map(
    ([directive, sources]) => `${directive} ${sources.join(" ")}`,
  );
  if (https) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export type PermissionFeature =
  "camera" | "microphone" | "geolocation" | "payment" | "usb" | "midi" | "browsing-topics";

const FEATURES: readonly PermissionFeature[] = [
  "camera",
  "microphone",
  "geolocation",
  "payment",
  "usb",
  "browsing-topics",
];

/**
 * The Permissions-Policy header: the features in `allow` only for this site's own pages, the rest
 * for nobody (not even an embedded page may ask for them).
 */
export function permissionsPolicy(allow: readonly PermissionFeature[] = []): string {
  const features = [...new Set([...FEATURES, ...allow])];
  return features.map((feature) => `${feature}=${allow.includes(feature) ? "(self)" : "()"}`).join(", ");
}

/** Every security header, in the shape of next.config.ts → headers(). */
export function securityHeaders(options: SecurityOptions = {}): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    // Two years of HTTPS only, for this host and its subdomains.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // frame-ancestors 'none', for browsers that predate it.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: permissionsPolicy(options.allow) },
    // Pages opened from here (or that open this site) get no handle on its window.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

/** Where the build runs, from the environment Vercel gives it (`dev` comes from Next's phase). */
export function deploymentOptions(env: Partial<Record<string, string>> = process.env): SecurityOptions {
  return { preview: env.VERCEL_ENV === "preview", https: Boolean(env.VERCEL) };
}
