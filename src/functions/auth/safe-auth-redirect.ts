/**
 * `true` when `redirect` is safe to assign to `window.location` after sign-in:
 * a same-site relative path or an absolute http(s) URL.
 *
 * Blocks `javascript:`, `data:`, `vbscript:` and friends (script execution in
 * the wallet origin) as well as protocol-relative (`//host`) and backslash
 * (`/\host`) tricks that browsers normalise into cross-origin navigations.
 */
export function isSafeAuthRedirect(redirect: string): boolean {
  if (typeof redirect !== "string" || redirect.length === 0) return false;
  // Browsers strip tab/newline/control characters inside URLs, which is how
  // "java\tscript:" style bypasses work. Reject them outright.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(redirect)) return false;
  if (redirect.startsWith("/")) {
    return !redirect.startsWith("//") && !redirect.startsWith("/\\");
  }
  return /^https?:\/\/[^\s/\\]+/i.test(redirect);
}
