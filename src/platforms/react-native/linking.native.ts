/**
 * React Native Linking Adapter
 * Uses React Native Linking API and optional InAppBrowser for OAuth
 */

import type { LinkingAdapter, AuthCallbackResult } from '../../adapters/types';
import type { ReactNativeLinking } from './react-native.types';

// Dynamic import to avoid bundler issues when react-native isn't available
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Linking = (
  require('react-native') as { Linking: ReactNativeLinking }
).Linking;

// Optional: react-native-inappbrowser-reborn for better OAuth UX
let InAppBrowser: any = null;
try {
  InAppBrowser = require('react-native-inappbrowser-reborn').default;
} catch {
  // InAppBrowser not installed, will use Linking.openURL
}

export const linkingAdapter: LinkingAdapter = {
  async openURL(url: string): Promise<void> {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error(`Cannot open URL: ${url}`);
    }
  },

  async openAuthWindow(url: string, callbackScheme: string): Promise<AuthCallbackResult> {
    // If InAppBrowser is available, use it for better UX
    if (InAppBrowser && (await InAppBrowser.isAvailable())) {
      try {
        const result = await InAppBrowser.openAuth(url, callbackScheme, {
          showTitle: false,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          ephemeralWebSession: false,
        });

        if (result.type === 'success' && result.url) {
          const callbackUrl = new URL(result.url);
          return {
            code: callbackUrl.searchParams.get('code') || undefined,
            state: callbackUrl.searchParams.get('state') || undefined,
            error: callbackUrl.searchParams.get('error') || undefined,
            errorDescription: callbackUrl.searchParams.get('error_description') || undefined,
          };
        } else if (result.type === 'cancel') {
          return { error: 'cancelled', errorDescription: 'User cancelled authentication' };
        }
        return { error: 'unknown', errorDescription: 'Unknown authentication result' };
      } catch (error) {
        return { error: 'failed', errorDescription: String(error) };
      }
    }

    // Fallback: Open in external browser and wait for deep link
    return new Promise((resolve) => {
      const subscription = Linking.addEventListener('url', (event: { url: string }) => {
        const callbackUrl = event.url;
        if (callbackUrl.startsWith(callbackScheme)) {
          subscription.remove();
          try {
            const parsedUrl = new URL(callbackUrl);
            resolve({
              code: parsedUrl.searchParams.get('code') || undefined,
              state: parsedUrl.searchParams.get('state') || undefined,
              error: parsedUrl.searchParams.get('error') || undefined,
              errorDescription: parsedUrl.searchParams.get('error_description') || undefined,
            });
          } catch {
            resolve({ error: 'parse_error', errorDescription: 'Failed to parse callback URL' });
          }
        }
      });

      Linking.openURL(url).catch((error: unknown) => {
        subscription.remove();
        resolve({ error: 'open_failed', errorDescription: String(error) });
      });
    });
  },

  getCurrentURL(): string | null {
    // React Native doesn't have a "current URL" like browsers
    // Initial URL is handled differently
    return null;
  },

  getURLParams(): Record<string, string> {
    // In React Native, URL params come from deep links, not a global location
    return {};
  },

  addURLListener(callback: (url: string) => void): () => void {
    const subscription = Linking.addEventListener('url', (event: { url: string }) => {
      callback(event.url);
    });

    // Also check for initial URL
    Linking.getInitialURL().then((url: string | null) => {
      if (url) callback(url);
    });

    return () => subscription.remove();
  },
};
