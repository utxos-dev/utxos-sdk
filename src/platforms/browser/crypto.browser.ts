/**
 * Browser Crypto Adapter
 * Implements CryptoAdapter using the Web Crypto API (crypto.subtle)
 * Works in all modern browsers without polyfills
 */

import type { CryptoAdapter } from '../../adapters/types';

/**
 * Map algorithm names to WebCrypto HMAC algorithm identifiers
 */
function getHmacAlgorithm(algorithm: string): HmacImportParams {
  // Normalize algorithm name (handle both "SHA256" and "SHA-256" formats)
  const normalized = algorithm.toUpperCase().replace(/SHA-?(\d+)/i, 'SHA-$1');
  return {
    name: 'HMAC',
    hash: { name: normalized },
  };
}

/**
 * Browser implementation of CryptoAdapter using Web Crypto API
 */
export const cryptoAdapter: CryptoAdapter = {
  /**
   * Generate cryptographically secure random bytes using crypto.getRandomValues
   */
  getRandomBytes(size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  },

  /**
   * HMAC signing using crypto.subtle
   */
  async hmacSign(algorithm: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const hmacAlgorithm = getHmacAlgorithm(algorithm);

    // Import the key for HMAC signing
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      hmacAlgorithm,
      false,
      ['sign']
    );

    // Sign the data
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);

    return new Uint8Array(signature);
  },

  /**
   * AES-GCM encryption using crypto.subtle
   */
  async encrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    // Import the key for AES-GCM encryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt the data
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      data
    );

    return new Uint8Array(ciphertext);
  },

  /**
   * AES-GCM decryption using crypto.subtle
   */
  async decrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    // Import the key for AES-GCM decryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt the data
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      data
    );

    return new Uint8Array(plaintext);
  },

  /**
   * Generate ECDH key pair using P-256 curve
   * Returns raw public and private key bytes
   */
  async generateKeyPair(_algorithm?: string): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    // Generate ECDH key pair with P-256 curve
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // extractable
      ['deriveBits']
    );

    // Export keys to raw format
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: new Uint8Array(publicKeyBuffer),
      privateKey: new Uint8Array(privateKeyBuffer),
    };
  },

  /**
   * Derive shared secret from ECDH key exchange
   * Uses P-256 curve and returns 256 bits (32 bytes)
   */
  async deriveSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
    // Import the private key (PKCS8 format)
    const privateKeyObj = await crypto.subtle.importKey(
      'pkcs8',
      privateKey,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      ['deriveBits']
    );

    // Import the public key (raw format - uncompressed point)
    const publicKeyObj = await crypto.subtle.importKey(
      'raw',
      publicKey,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    // Derive the shared secret (256 bits for P-256)
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: publicKeyObj,
      },
      privateKeyObj,
      256 // P-256 produces 256 bits
    );

    return new Uint8Array(sharedSecret);
  },

  /**
   * Import raw key for crypto operations
   * Supports AES-GCM and HMAC algorithms
   */
  async importKey(keyData: Uint8Array, algorithm: string, usages: string[]): Promise<CryptoKey> {
    // Normalize algorithm name
    const normalizedAlgorithm = algorithm.toUpperCase();

    let algorithmParams: AlgorithmIdentifier | HmacImportParams | AesKeyAlgorithm;

    if (normalizedAlgorithm === 'AES-GCM' || normalizedAlgorithm === 'AESGCM') {
      algorithmParams = { name: 'AES-GCM' };
    } else if (normalizedAlgorithm.startsWith('HMAC')) {
      // Extract hash algorithm if specified (e.g., "HMAC-SHA-256")
      const hashMatch = normalizedAlgorithm.match(/HMAC[- ]?(SHA[- ]?\d+)?/i);
      const hashName = hashMatch?.[1]?.replace(/[- ]/g, '-') || 'SHA-256';
      algorithmParams = {
        name: 'HMAC',
        hash: { name: hashName },
      };
    } else if (normalizedAlgorithm.includes('SHA')) {
      // HMAC with specified hash
      algorithmParams = {
        name: 'HMAC',
        hash: { name: normalizedAlgorithm.replace(/SHA-?(\d+)/i, 'SHA-$1') },
      };
    } else {
      // Default to the algorithm name as-is
      algorithmParams = { name: algorithm };
    }

    return crypto.subtle.importKey(
      'raw',
      keyData,
      algorithmParams,
      false,
      usages as KeyUsage[]
    );
  },
};
