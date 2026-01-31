import { getCrypto } from '../../internal/platform-context';

// Re-export adapter accessor
export { getCrypto };

// Create a crypto-like interface that uses the adapter
// This maintains backward compatibility with code using crypto.subtle
export const crypto = {
  getRandomValues<T extends ArrayBufferView>(array: T): T {
    return getCrypto().getRandomValuesInPlace(array);
  },
  get subtle(): SubtleCrypto {
    return getCrypto().getSubtleCrypto();
  }
};

export * from "./encryption";
export * from "./hash";
