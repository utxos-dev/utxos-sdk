import { OpenWindowParams } from "../../types/window";
import { getLinking } from "../../internal/platform-context";
import { normalizeRedirectUri } from "../auth/redirect-uri";
import {
  createHandoffChallenge,
  exchangeHandoffCode,
  safeEqual,
} from "./native-handoff";

export type OpenWindowOptions = {
  /**
   * App link the wallet returns to once the user is done, e.g. `atlas://wallet`
   * or `https://app.example.com/wallet-callback`.
   *
   * Required on React Native (and other redirect-based platforms), where the
   * wallet runs in the system browser and hands the result back through this
   * link. It must be registered in the app and added to the project's
   * whitelisted URLs in the UTXOS dashboard. Ignored in browsers, which use a
   * popup and `postMessage`.
   */
  redirectUri?: string;
};

const MAX_ERROR_MESSAGE_LENGTH = 200;

function buildQuery(entries: Array<[string, string]>): string {
  return entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function clip(message: string): string {
  return message.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`
    : message;
}

/**
 * Open a wallet window for user authentication and operations.
 *
 * This function delegates to the platform-specific linking adapter which handles:
 * - Browsers: popup window creation, `postMessage` communication for receiving
 *   results, and window close detection.
 * - React Native: the system browser (Google blocks embedded WebViews) and a
 *   PKCE-protected deep link hand-off, see `native-handoff.ts`.
 *
 * @param params - Method-specific parameters for the wallet operation
 * @param appUrl - Base URL for the wallet app (defaults to utxos.dev)
 * @param options - Platform options such as the app `redirectUri`
 * @returns Promise resolving to the operation result from the wallet window
 */
export async function openWindow(
  params: OpenWindowParams,
  appUrl: string = "https://utxos.dev/",
  options: OpenWindowOptions = {},
): Promise<any> {
  const linking = getLinking();
  const useRedirect = linking.supportsRedirectCallback === true;

  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(params as Record<string, string>)) {
    if (
      value != null &&
      value !== "" &&
      value !== "undefined" &&
      value !== "null"
    ) {
      entries.push([key, String(value)]);
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    entries.push(["origin", window.location.origin]);
  }

  // ---- Redirect based platforms (React Native) --------------------------------
  if (useRedirect) {
    if (!options.redirectUri) {
      throw new Error(
        "@utxos/sdk: `redirectUri` is required on React Native. " +
          "Pass the app link the wallet should return to (e.g. 'myapp://wallet'), " +
          "register it in your app, and add it to your project's whitelisted URLs.",
      );
    }
    const redirectUri = normalizeRedirectUri(options.redirectUri);
    if (!redirectUri) {
      throw new Error(
        "@utxos/sdk: `redirectUri` is not a valid app link. Use a custom scheme " +
          "(e.g. 'myapp://wallet') or an https universal link, without query or fragment.",
      );
    }

    const challenge = await createHandoffChallenge();
    entries.push(
      ["redirect_uri", redirectUri],
      ["state", challenge.state],
      ["code_challenge", challenge.codeChallenge],
      ["code_challenge_method", "S256"],
    );
    const url = `${appUrl}/client/wallet?${buildQuery(entries)}`;

    const result = await linking.openAuthWindow(url, redirectUri, {
      state: challenge.state,
    });

    if (result.error === "cancelled") {
      return { success: false, message: "Window was closed by the user" };
    }
    if (result.error) {
      return {
        success: false,
        message: clip(result.errorDescription || result.error),
      };
    }
    // Defence in depth: adapters already filter on state, but never trust that.
    if (!result.state || !safeEqual(result.state, challenge.state)) {
      return {
        success: false,
        message: "The wallet response could not be verified. Please try again.",
      };
    }
    if (!result.code) {
      return { success: false, message: "The wallet did not return a result." };
    }

    return exchangeHandoffCode({
      appUrl,
      projectId: (params as { projectId: string }).projectId,
      code: result.code,
      codeVerifier: challenge.codeVerifier,
    });
  }

  // ---- Popup based platforms (browsers) -----------------------------------------
  const url = `${appUrl}/client/wallet?${buildQuery(entries)}`;
  const result = await linking.openAuthWindow(url, "");

  // Handle user cancellation (window closed)
  if (result.error === "cancelled") {
    return { success: false, message: "Window was closed by the user" };
  }

  // Handle other errors
  if (result.error) {
    return {
      success: false,
      message: result.errorDescription || result.error,
    };
  }

  // Return the full wallet response data
  // The platform adapter captures the complete postMessage payload
  return result.data;
}
