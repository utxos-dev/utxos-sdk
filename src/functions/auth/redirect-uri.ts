/**
 * Redirect URI helpers for native (deep link / universal link) wallet hand-off.
 *
 * Security notes
 * --------------
 * - These helpers deliberately do NOT use the global `URL` class. React Native's
 *   `URL` implementation does not parse host/pathname, so behaviour would differ
 *   between platforms. A small strict parser keeps validation identical on the
 *   SDK (React Native) and on the wallet backend/app.
 * - A redirect URI is only accepted when it is in a canonical, query-less form
 *   and matches a whitelist entry *exactly* (scheme + authority + path). No
 *   wildcards, no prefix matching, no origin-only matching for paths.
 */

/** Maximum accepted length of a redirect URI. */
export const REDIRECT_URI_MAX_LENGTH = 2048;

/**
 * Schemes that must never be used as an app redirect target. `http:` is blocked
 * because it is neither verifiable (no app/universal links) nor confidential.
 */
const BLOCKED_REDIRECT_SCHEMES = new Set([
  "javascript",
  "data",
  "vbscript",
  "file",
  "blob",
  "about",
  "filesystem",
  "view-source",
  "http",
  "ftp",
  "ws",
  "wss",
  "intent",
  "content",
  "chrome",
  "chrome-extension",
  "tel",
  "sms",
  "mailto",
]);

// scheme://authority/path?query#fragment
const URI_PATTERN =
  /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

// Printable ASCII only (no whitespace, control characters or unicode look-alikes).
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

type UriParts = {
  scheme: string;
  authority: string;
  path: string;
  query: string | undefined;
  fragment: string | undefined;
};

function splitUri(input: string): UriParts | null {
  if (typeof input !== "string") return null;
  if (input.length === 0 || input.length > REDIRECT_URI_MAX_LENGTH) return null;
  if (!PRINTABLE_ASCII.test(input)) return null;
  // Reject backslashes: a classic vehicle for parser-differential tricks.
  if (input.includes("\\")) return null;

  const match = URI_PATTERN.exec(input);
  if (!match) return null;
  const [, scheme = "", authority = "", path = "", query, fragment] = match;
  // Reject percent-encoding in the authority and path (path-traversal and
  // parser-differential tricks). No legitimate redirect URI needs it. Query
  // values (used by callbacks) may be percent-encoded.
  if (authority.includes("%") || path.includes("%")) return null;
  return {
    scheme: scheme.toLowerCase(),
    authority,
    path,
    query,
    fragment,
  };
}

function canonicalize(parts: UriParts): string | null {
  const { scheme } = parts;
  if (BLOCKED_REDIRECT_SCHEMES.has(scheme)) return null;

  // No credentials, ever.
  if (parts.authority.includes("@")) return null;

  let authority = parts.authority;
  if (scheme === "https") {
    // Web links: a real host is mandatory and hosts are case-insensitive.
    if (authority.length === 0) return null;
    authority = authority.toLowerCase();
  }

  // Drop trailing slashes so "app://cb" and "app://cb/" are the same target,
  // and refuse dot-segments instead of trying to resolve them.
  const segments = parts.path.split("/");
  if (segments.some((s) => s === "." || s === "..")) return null;
  if (parts.path.includes("//")) return null;
  const path = parts.path.replace(/\/+$/, "");

  return `${scheme}://${authority}${path}`;
}

/**
 * Validate and canonicalise an app redirect URI such as `atlas://wallet` or
 * `https://app.example.com/auth/callback`.
 *
 * Returns the canonical form, or `null` when the value is not a safe redirect
 * URI. Redirect URIs must not carry a query string or fragment; the wallet
 * appends its own parameters.
 */
export function normalizeRedirectUri(input: string): string | null {
  const parts = splitUri(input);
  if (!parts) return null;
  if (parts.query !== undefined || parts.fragment !== undefined) return null;
  return canonicalize(parts);
}

/** `true` when `input` is a safe redirect URI (see {@link normalizeRedirectUri}). */
export function isValidRedirectUri(input: string): boolean {
  return normalizeRedirectUri(input) !== null;
}

/**
 * Exact-match check of a redirect URI against a project whitelist.
 *
 * Whitelist entries that are not valid redirect URIs (for example plain web
 * origins such as `http://localhost:3000`) are ignored for this purpose.
 */
export function isRedirectUriWhitelisted(
  redirectUri: string,
  whitelist: readonly string[] | null | undefined,
): boolean {
  const target = normalizeRedirectUri(redirectUri);
  if (!target || !whitelist) return false;
  for (const entry of whitelist) {
    if (typeof entry !== "string") continue;
    if (normalizeRedirectUri(entry) === target) return true;
  }
  return false;
}

function decodeQueryComponent(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

/**
 * Parse the callback URL the wallet redirected to.
 *
 * Returns the query parameters only if the URL (minus its query/fragment) is
 * *exactly* the expected redirect URI; otherwise `null`. Parameters in the
 * fragment are intentionally ignored.
 */
export function parseRedirectCallback(
  callbackUrl: string,
  expectedRedirectUri: string,
): Record<string, string> | null {
  const expected = normalizeRedirectUri(expectedRedirectUri);
  if (!expected) return null;

  const parts = splitUri(callbackUrl.replace(/#.*$/, ""));
  if (!parts) return null;
  const received = canonicalize({ ...parts, query: undefined });
  if (received !== expected) return null;

  const params: Record<string, string> = {};
  if (parts.query) {
    for (const pair of parts.query.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const rawKey = eq === -1 ? pair : pair.slice(0, eq);
      const rawValue = eq === -1 ? "" : pair.slice(eq + 1);
      const key = decodeQueryComponent(rawKey);
      const value = decodeQueryComponent(rawValue);
      if (key === null || value === null) return null;
      // First occurrence wins: a later duplicate must not override it.
      if (!(key in params)) params[key] = value;
    }
  }
  return params;
}

/**
 * Append query parameters to a *canonical* redirect URI.
 */
export function buildRedirectUrl(
  redirectUri: string,
  params: Record<string, string | undefined>,
): string | null {
  const base = normalizeRedirectUri(redirectUri);
  if (!base) return null;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`,
    )
    .join("&");
  return query ? `${base}?${query}` : base;
}
