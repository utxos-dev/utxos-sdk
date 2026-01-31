/**
 * Browser Linking Adapter
 * Handles URL opening, OAuth popups, and URL parsing for browsers
 */

import type { LinkingAdapter, AuthCallbackResult } from '../../adapters/types';

/**
 * Calculate centered popup position relative to current window
 */
function calculatePopupPosition(width: number, height: number): { left: number; top: number } {
  const screenWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const screenHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;

  // Account for window position on multi-monitor setups
  const windowLeft = window.screenX || window.screenLeft || 0;
  const windowTop = window.screenY || window.screenTop || 0;

  const left = (screenWidth - width) / 2 + windowLeft;
  const top = (screenHeight - height) / 2 + windowTop;

  return {
    left: Math.max(0, left),
    top: Math.max(0, top)
  };
}

/**
 * Build window features string for popup
 * Handles mobile/fullscreen scenarios
 */
function buildWindowFeatures(width: number, height: number): string {
  const windowWidth = window.innerWidth || 0;
  const windowHeight = window.innerHeight || 0;

  const isMobile = windowWidth < 640;
  const isFullScreen = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );

  const shouldDisplayFullScreen = isMobile || isFullScreen;

  const finalWidth = shouldDisplayFullScreen ? windowWidth : width;
  const finalHeight = shouldDisplayFullScreen ? windowHeight : height;

  const { left, top } = calculatePopupPosition(finalWidth, finalHeight);

  return `left=${left},top=${top},width=${finalWidth},height=${finalHeight},scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no`;
}

export const linkingAdapter: LinkingAdapter = {
  /**
   * Open URL in new browser tab
   */
  async openURL(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  /**
   * Redirect current page to URL (same-tab navigation)
   * Used for auth flow redirects after token storage
   */
  async redirectURL(url: string): Promise<void> {
    window.location.href = url;
  },

  /**
   * Open OAuth popup window and wait for callback via postMessage
   * Handles popup blocked, user close, and message events
   */
  async openAuthWindow(url: string, callbackScheme: string): Promise<AuthCallbackResult> {
    return new Promise((resolve, reject) => {
      const width = 448;
      const height = 668;
      const features = buildWindowFeatures(width, height);

      const popup = window.open(url, 'utxos', features);

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let resolved = false;

      const cleanup = () => {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        window.removeEventListener('message', handleMessage);
      };

      const resolveOnce = (result: AuthCallbackResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      const handleMessage = (event: MessageEvent) => {
        // Verify message is from our auth flow
        if (!event.data || typeof event.data !== 'object') {
          return;
        }

        const { code, state, error, error_description, target } = event.data;

        // Check for utxos-specific target or OAuth params
        if (target === 'utxos' || code || error) {
          if (!popup.closed) {
            popup.close();
          }
          resolveOnce({
            code,
            state,
            error,
            errorDescription: error_description,
            // Include full message data for wallet-specific payloads
            data: event.data,
          });
        }
      };

      window.addEventListener('message', handleMessage);

      // Poll for popup close (user manually closed)
      pollTimer = setInterval(() => {
        if (popup.closed) {
          resolveOnce({
            error: 'cancelled',
            errorDescription: 'User closed the popup'
          });
        }
      }, 500);
    });
  },

  /**
   * Get current page URL
   */
  getCurrentURL(): string | null {
    if (typeof window === 'undefined') return null;
    return window.location.href;
  },

  /**
   * Parse URL query parameters from current page
   */
  getURLParams(): Record<string, string> {
    if (typeof window === 'undefined') return {};

    const params = new URLSearchParams(window.location.search);
    const result: Record<string, string> = {};

    params.forEach((value, key) => {
      result[key] = value;
    });

    // Also check hash params (for OAuth implicit flow)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      hashParams.forEach((value, key) => {
        result[key] = value;
      });
    }

    return result;
  },

  /**
   * Add listener for URL changes (SPA navigation)
   * Returns cleanup function to remove listener
   */
  addURLListener(callback: (url: string) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handler = () => callback(window.location.href);

    window.addEventListener('popstate', handler);
    window.addEventListener('hashchange', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('hashchange', handler);
    };
  },

  getUserAgent(): string | null {
    if (typeof navigator === 'undefined') return null;
    return navigator.userAgent;
  },
};
