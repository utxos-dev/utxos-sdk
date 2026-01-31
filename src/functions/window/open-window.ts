import { OpenWindowParams } from "../../types/window";
import { getLinking } from "../../internal/platform-context";

/**
 * Open a wallet window for user authentication and operations.
 *
 * This function delegates to the platform-specific linking adapter which handles:
 * - Popup window creation with appropriate sizing
 * - postMessage communication for receiving results
 * - Window close detection
 *
 * @param params - Method-specific parameters for the wallet operation
 * @param appUrl - Base URL for the wallet app (defaults to utxos.dev)
 * @returns Promise resolving to the operation result from the wallet window
 */
export async function openWindow(
  params: OpenWindowParams,
  appUrl: string = "https://utxos.dev/",
): Promise<any> {
  // Build the wallet URL with query parameters
  const p = new URLSearchParams(params as Record<string, string>);
  const url = `${appUrl}/client/wallet?${p.toString()}`;

  // Delegate to platform-specific linking adapter
  const result = await getLinking().openAuthWindow(url, "utxos://callback");

  // Handle user cancellation (window closed)
  if (result.error === "cancelled") {
    return { success: false, message: "Window was closed by the user" };
  }

  // Handle other errors
  if (result.error) {
    return {
      success: false,
      message: result.errorDescription || result.error
    };
  }

  // Return the full wallet response data
  // The platform adapter captures the complete postMessage payload
  return result.data;
}
