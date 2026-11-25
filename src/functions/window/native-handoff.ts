/**
 * Native hand-off protocol (PKCE-style) for returning wallet results to a
 * mobile app through a deep link / universal link.
 *
 *   1. The SDK generates `state`, a PKCE `code_verifier` and its S256
 *      `code_challenge`, and opens the wallet page in the system browser.
 *   2. The wallet page stores the result server-side, bound to the
 *      `code_challenge`, and redirects to `redirect_uri?code=...&state=...`.
 *      The redirect only carries an opaque, single-use, short-lived code, never
 *      the wallet result itself.
 *   3. The SDK verifies `state`, then redeems the code together with the
 *      `code_verifier`. Another app that intercepts the deep link cannot redeem
 *      the code because it does not know the verifier.
 *
 * Follows RFC 8252 (OAuth for native apps) and RFC 7636 (PKCE).
 */

import { getCrypto, getEncoding } from "../../internal/platform-context";
import type { OpenWindowResult } from "../../types";

/** Path of the wallet backend endpoint that redeems a hand-off code. */
export const NATIVE_HANDOFF_EXCHANGE_PATH = "/api/native-handoff/exchange";

/** Upper bound for the exchange request, so a stalled network cannot hang the app. */
const EXCHANGE_TIMEOUT_MS = 15_000;

export type HandoffChallenge = {
  /** Opaque value echoed back in the redirect; binds the callback to this request. */
  state: string;
  /** Secret kept in memory by the app; never sent to the browser. */
  codeVerifier: string;
  /** `BASE64URL(SHA256(codeVerifier))`, sent to the wallet page. */
  codeChallenge: string;
};

function toBase64Url(bytes: Uint8Array): string {
  return getEncoding()
    .bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(byteLength = 32): string {
  return toBase64Url(getCrypto().getRandomBytes(byteLength));
}

/** Generate a fresh `state`, PKCE verifier and S256 challenge. */
export async function createHandoffChallenge(): Promise<HandoffChallenge> {
  const state = randomToken();
  const codeVerifier = randomToken();
  const digest = await getCrypto()
    .getSubtleCrypto()
    .digest(
      "SHA-256",
      getEncoding().utf8ToBytes(codeVerifier) as BufferSource,
    );
  return {
    state,
    codeVerifier,
    codeChallenge: toBase64Url(new Uint8Array(digest)),
  };
}

/** Constant-time string comparison for values such as `state`. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** `scheme://authority` of an absolute http(s) URL, without relying on `URL`. */
export function getUrlOrigin(url: string): string | null {
  const match = /^(https?):\/\/([^/?#]+)/i.exec(url.trim());
  if (!match) return null;
  const [, scheme = "", authority = ""] = match;
  return `${scheme.toLowerCase()}://${authority.toLowerCase()}`;
}

/**
 * Redeem a hand-off code for the wallet result.
 * Never throws: failures are returned as `{ success: false }`.
 */
export async function exchangeHandoffCode(params: {
  appUrl: string;
  projectId: string;
  code: string;
  codeVerifier: string;
}): Promise<OpenWindowResult> {
  const origin = getUrlOrigin(params.appUrl);
  if (!origin) {
    return { success: false, message: "Invalid wallet URL." };
  }

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), EXCHANGE_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(origin + NATIVE_HANDOFF_EXCHANGE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: params.projectId,
        code: params.code,
        codeVerifier: params.codeVerifier,
      }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        message:
          response.status === 429
            ? "Too many attempts. Please try again shortly."
            : "The wallet response expired or was already used. Please try again.",
      };
    }

    const body = (await response.json()) as OpenWindowResult | null;
    if (
      !body ||
      typeof body !== "object" ||
      typeof (body as { success?: unknown }).success !== "boolean"
    ) {
      return { success: false, message: "Unexpected wallet response." };
    }
    return body;
  } catch {
    return {
      success: false,
      message: "Could not reach the wallet service. Please try again.",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
