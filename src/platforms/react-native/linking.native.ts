/**
 * React Native Linking Adapter
 * Uses React Native Linking API and optional InAppBrowser for OAuth
 */

import type {
  LinkingAdapter,
  AuthCallbackResult,
  OpenAuthWindowOptions,
} from '../../adapters/types';
import { parseRedirectCallback } from '../../functions/auth/redirect-uri';
import { safeEqual } from '../../functions/window/native-handoff';
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

/** How long to wait for the user to come back from the browser. */
const DEFAULT_CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

export const linkingAdapter: LinkingAdapter = {
  supportsRedirectCallback: true,

  async openURL(url: string): Promise<void> {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error(`Cannot open URL: ${url}`);
    }
  },

  /**
   * Redirect to URL - in React Native, this is equivalent to openURL
   * since there's no browser-style same-tab navigation
   */
  async redirectURL(url: string): Promise<void> {
    await this.openURL(url);
  },

  /**
   * Open the wallet in the *system* browser and wait for the redirect back to
   * the app.
   *
   * Google (and other identity providers) refuse OAuth inside embedded
   * WebViews (`disallowed_useragent`), so this must use ASWebAuthenticationSession /
   * Chrome Custom Tabs (via react-native-inappbrowser-reborn) or the external
   * browser, never a WebView.
   *
   * Only callbacks that match `redirectUri` exactly *and* carry the expected
   * `state` are accepted; everything else is ignored.
   */
  async openAuthWindow(
    url: string,
    redirectUri: string,
    options: OpenAuthWindowOptions = {},
  ): Promise<AuthCallbackResult> {
    const expectedState = options.state;

    const toResult = (callbackUrl: string): AuthCallbackResult | null => {
      const params = parseRedirectCallback(callbackUrl, redirectUri);
      if (!params) return null;
      if (expectedState !== undefined) {
        if (typeof params.state !== 'string' || !safeEqual(params.state, expectedState)) {
          return null;
        }
      }
      return {
        code: params.code,
        state: params.state,
        error: params.error,
        errorDescription: params.error_description,
      };
    };

    // Preferred: system auth session with a built-in callback interceptor.
    if (InAppBrowser && (await InAppBrowser.isAvailable())) {
      try {
        const result = await InAppBrowser.openAuth(url, redirectUri, {
          // iOS: share cookies with Safari so the user's Google session is reused.
          ephemeralWebSession: false,
          // Android
          showTitle: false,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          showInRecents: false,
        });

        if (result.type === 'success' && result.url) {
          return (
            toResult(result.url) ?? {
              error: 'invalid_callback',
              errorDescription: 'Unexpected callback received from the wallet',
            }
          );
        }
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return { error: 'cancelled', errorDescription: 'User cancelled authentication' };
        }
        return { error: 'unknown', errorDescription: 'Unknown authentication result' };
      } catch (error) {
        return { error: 'failed', errorDescription: String(error) };
      }
    }

    // Fallback: external browser, wait for the deep link.
    const timeoutMs = options.timeoutMs ?? DEFAULT_CALLBACK_TIMEOUT_MS;
    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let subscription: { remove(): void } | null = null;

      const finish = (result: AuthCallbackResult) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        subscription?.remove();
        resolve(result);
      };

      subscription = Linking.addEventListener('url', (event: { url: string }) => {
        const result = toResult(event.url);
        if (result) finish(result);
      });

      timer = setTimeout(
        () => finish({ error: 'timeout', errorDescription: 'Timed out waiting for the wallet' }),
        timeoutMs,
      );

      Linking.openURL(url).catch((error: unknown) => {
        finish({ error: 'open_failed', errorDescription: String(error) });
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

  getUserAgent(): string | null {
    return 'ReactNative';
  },
};
