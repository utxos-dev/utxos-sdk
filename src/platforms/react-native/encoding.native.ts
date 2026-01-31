/**
 * React Native Encoding Adapter
 * Uses same implementation as browser (TextEncoder/TextDecoder available in RN)
 */

import type { EncodingAdapter } from '../../adapters/types';

// React Native has TextEncoder/TextDecoder since React Native 0.72+
// For older versions, a polyfill may be needed

// Base64 character lookup table
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Manual base64 encode implementation for React Native
 * React Native doesn't have btoa/atob natively
 */
function base64Encode(str: string): string {
  let result = '';
  const len = str.length;

  for (let i = 0; i < len; i += 3) {
    const a = str.charCodeAt(i);
    const b = i + 1 < len ? str.charCodeAt(i + 1) : 0;
    const c = i + 2 < len ? str.charCodeAt(i + 2) : 0;

    result += BASE64_CHARS[a >> 2];
    result += BASE64_CHARS[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[c & 63] : '=';
  }

  return result;
}

/**
 * Manual base64 decode implementation for React Native
 * React Native doesn't have btoa/atob natively
 */
function base64Decode(str: string): string {
  // Handle URL-safe base64
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');

  // Remove padding
  const cleanBase64 = normalized.replace(/=/g, '');
  const len = cleanBase64.length;

  let result = '';
  for (let i = 0; i < len; i += 4) {
    const a = BASE64_CHARS.indexOf(cleanBase64[i] ?? '');
    const b = BASE64_CHARS.indexOf(cleanBase64[i + 1] ?? '');
    const c = i + 2 < len ? BASE64_CHARS.indexOf(cleanBase64[i + 2] ?? '') : 0;
    const d = i + 3 < len ? BASE64_CHARS.indexOf(cleanBase64[i + 3] ?? '') : 0;

    result += String.fromCharCode((a << 2) | (b >> 4));
    if (i + 2 < len) result += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (i + 3 < len) result += String.fromCharCode(((c & 3) << 6) | d);
  }

  return result;
}

export const encodingAdapter: EncodingAdapter = {
  bytesToBase64(bytes: Uint8Array): string {
    // Convert bytes to binary string then encode
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        binary += String.fromCharCode(byte);
      }
    }
    return base64Encode(binary);
  },

  base64ToBytes(base64: string): Uint8Array {
    // Handle URL-safe base64
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');

    // Remove padding
    const cleanBase64 = normalized.replace(/=/g, '');
    const len = cleanBase64.length;
    const byteLen = Math.floor((len * 3) / 4);
    const bytes = new Uint8Array(byteLen);

    let p = 0;
    for (let i = 0; i < len; i += 4) {
      const a = BASE64_CHARS.indexOf(cleanBase64[i] ?? '');
      const b = BASE64_CHARS.indexOf(cleanBase64[i + 1] ?? '');
      const c = i + 2 < len ? BASE64_CHARS.indexOf(cleanBase64[i + 2] ?? '') : 0;
      const d = i + 3 < len ? BASE64_CHARS.indexOf(cleanBase64[i + 3] ?? '') : 0;

      bytes[p++] = (a << 2) | (b >> 4);
      if (p < byteLen) bytes[p++] = ((b & 15) << 4) | (c >> 2);
      if (p < byteLen) bytes[p++] = ((c & 3) << 6) | d;
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
    // TextDecoder available in RN 0.72+
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(bytes);
    }
    // Fallback for older RN versions
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        str += String.fromCharCode(byte);
      }
    }
    return decodeURIComponent(escape(str));
  },

  utf8ToBytes(str: string): Uint8Array {
    // TextEncoder available in RN 0.72+
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    // Fallback for older RN versions
    const encoded = unescape(encodeURIComponent(str));
    const bytes = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i++) {
      bytes[i] = encoded.charCodeAt(i);
    }
    return bytes;
  },
};
