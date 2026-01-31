/**
 * Browser Encoding Adapter
 * Replaces Node.js Buffer with browser-native APIs
 */

import type { EncodingAdapter } from '../../adapters/types';

export const encodingAdapter: EncodingAdapter = {
  bytesToBase64(bytes: Uint8Array): string {
    // Use btoa with binary string conversion
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        binary += String.fromCharCode(byte);
      }
    }
    return btoa(binary);
  },

  base64ToBytes(base64: string): Uint8Array {
    // Handle URL-safe base64
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  },

  bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  hexToBytes(hex: string): Uint8Array {
    const matches = hex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array(0);
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
  },

  bytesToUtf8(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  },

  utf8ToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  },
};
