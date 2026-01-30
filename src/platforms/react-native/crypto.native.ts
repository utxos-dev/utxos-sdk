/**
 * React Native Crypto Adapter
 * Uses react-native-quick-crypto (JSI-based) or WebCrypto polyfill
 */

import type { CryptoAdapter } from '../../adapters/types';

// Try to use react-native-quick-crypto if available (much faster, JSI-based)
let QuickCrypto: any = null;
try {
  QuickCrypto = require('react-native-quick-crypto');
} catch {
  // Fall back to global.crypto (requires react-native-get-random-values polyfill)
}

// Get crypto object - either from quick-crypto or global polyfill
function getCrypto(): Crypto {
  if (QuickCrypto?.webcrypto) {
    return QuickCrypto.webcrypto;
  }
  if (typeof global !== 'undefined' && global.crypto?.subtle) {
    return global.crypto;
  }
  throw new Error(
    '@utxos/sdk: No crypto implementation found. ' +
      'Install react-native-quick-crypto or react-native-get-random-values'
  );
}

export const cryptoAdapter: CryptoAdapter = {
  getRandomBytes(size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    getCrypto().getRandomValues(bytes);
    return bytes;
  },

  async hmacSign(algorithm: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const crypto = getCrypto();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(signature);
  },

  async encrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const crypto = getCrypto();
    const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    return new Uint8Array(encrypted);
  },

  async decrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const crypto = getCrypto();
    const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    return new Uint8Array(decrypted);
  },

  async generateKeyPair(
    algorithm = 'ECDH'
  ): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    const crypto = getCrypto();
    const keyPair = await crypto.subtle.generateKey(
      { name: algorithm, namedCurve: 'P-256' },
      true,
      algorithm === 'ECDH' ? ['deriveBits'] : ['sign', 'verify']
    );
    const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    return {
      publicKey: new Uint8Array(publicKey),
      privateKey: new Uint8Array(privateKey),
    };
  },

  async deriveSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
    const crypto = getCrypto();
    const privKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    );
    const pubKey = await crypto.subtle.importKey(
      'raw',
      publicKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: pubKey },
      privKey,
      256
    );
    return new Uint8Array(sharedSecret);
  },

  async importKey(keyData: Uint8Array, algorithm: string, usages: string[]): Promise<CryptoKey> {
    const crypto = getCrypto();
    return crypto.subtle.importKey('raw', keyData, algorithm, false, usages as KeyUsage[]);
  },
};
