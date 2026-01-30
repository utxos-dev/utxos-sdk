/**
 * Platform Context - Internal singleton that holds platform-specific adapters
 *
 * This module is initialized automatically when the SDK is imported.
 * Browser entry (index.ts) sets browser adapters.
 * React Native entry (index.native.ts) sets RN adapters.
 *
 * Internal use only - not exported from main package.
 */

import type {
  PlatformAdapters,
  CryptoAdapter,
  StorageAdapter,
  LinkingAdapter,
  EncodingAdapter,
} from '../adapters/types';

// Global singleton - set once at module load time
let _adapters: PlatformAdapters | null = null;
let _initialized = false;

/**
 * Initialize platform adapters. Called automatically by entry points.
 * @internal
 */
export function setAdapters(adapters: PlatformAdapters): void {
  if (_initialized) {
    // Allow re-initialization in development/hot reload scenarios
    if (process.env.NODE_ENV === 'development') {
      console.warn('@utxos/sdk: Re-initializing adapters (development mode)');
    } else {
      console.warn('@utxos/sdk: Adapters already initialized, ignoring');
      return;
    }
  }
  _adapters = adapters;
  _initialized = true;
}

/**
 * Get all platform adapters
 * @internal
 */
export function getAdapters(): PlatformAdapters {
  if (!_adapters) {
    throw new Error(
      '@utxos/sdk: Platform adapters not initialized. ' +
        'This usually means the SDK was imported incorrectly. ' +
        'Import from "@utxos/sdk" directly, not from internal paths.'
    );
  }
  return _adapters;
}

/**
 * Check if adapters are initialized
 * @internal
 */
export function isInitialized(): boolean {
  return _initialized;
}

// Convenience accessors for internal use
export function getCrypto(): CryptoAdapter {
  return getAdapters().crypto;
}

export function getStorage(): StorageAdapter {
  return getAdapters().storage;
}

export function getLinking(): LinkingAdapter {
  return getAdapters().linking;
}

export function getEncoding(): EncodingAdapter {
  return getAdapters().encoding;
}
