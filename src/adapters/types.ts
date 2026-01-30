/**
 * Platform adapter interfaces for universal SDK support
 * These abstractions enable the SDK to work on Browser, React Native, and Node.js
 */

/**
 * Cryptographic operations adapter
 * Abstracts Web Crypto API and platform-specific crypto implementations
 */
export interface CryptoAdapter {
  /**
   * Generate cryptographically secure random bytes
   * @param size - Number of random bytes to generate
   * @returns Uint8Array of random bytes
   */
  getRandomBytes(size: number): Uint8Array;

  /**
   * HMAC signing operation
   * @param algorithm - Hash algorithm (e.g., 'SHA-256', 'SHA-512')
   * @param key - HMAC key as bytes
   * @param data - Data to sign
   * @returns Promise resolving to HMAC signature bytes
   */
  hmacSign(algorithm: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array>;

  /**
   * AES-GCM encryption
   * @param data - Plaintext data to encrypt
   * @param key - Encryption key (256-bit for AES-256)
   * @param iv - Initialization vector (12-16 bytes)
   * @returns Promise resolving to ciphertext bytes
   */
  encrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array>;

  /**
   * AES-GCM decryption
   * @param data - Ciphertext to decrypt
   * @param key - Decryption key
   * @param iv - Initialization vector used during encryption
   * @returns Promise resolving to plaintext bytes
   */
  decrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array>;

  /**
   * Generate ECDH key pair for key exchange
   * @param algorithm - Algorithm name (default: 'ECDH' with P-256 curve)
   * @returns Promise resolving to public and private key bytes
   */
  generateKeyPair(algorithm?: string): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>;

  /**
   * Derive shared secret from ECDH key exchange
   * @param privateKey - Local private key bytes
   * @param publicKey - Remote public key bytes
   * @returns Promise resolving to shared secret bytes
   */
  deriveSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array>;

  /**
   * Import raw key for crypto operations
   * @param keyData - Raw key bytes
   * @param algorithm - Algorithm for key usage (e.g., 'AES-GCM', 'HMAC')
   * @param usages - Key usages (e.g., ['encrypt', 'decrypt'])
   * @returns Promise resolving to CryptoKey object
   */
  importKey(keyData: Uint8Array, algorithm: string, usages: string[]): Promise<CryptoKey>;
}

/**
 * Persistent storage adapter
 * Abstracts localStorage (Browser), AsyncStorage (React Native), and file/memory storage (Node.js)
 */
export interface StorageAdapter {
  /**
   * Get item from persistent storage
   * @param key - Storage key
   * @returns Promise resolving to stored value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Set item in persistent storage
   * @param key - Storage key
   * @param value - Value to store (must be serializable to string)
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove item from persistent storage
   * @param key - Storage key to remove
   */
  removeItem(key: string): Promise<void>;

  /**
   * Clear all items from storage
   * Use with caution - removes all stored data
   */
  clear(): Promise<void>;
}

/**
 * URL/linking operations adapter
 * Abstracts window.open (Browser), Linking API (React Native), and external process (Node.js)
 */
export interface LinkingAdapter {
  /**
   * Open URL in appropriate context
   * Browser: new tab or popup window
   * React Native: external browser or in-app browser
   * Node.js: system default browser
   * @param url - URL to open
   */
  openURL(url: string): Promise<void>;

  /**
   * Open OAuth/auth window and wait for callback
   * Handles popup window lifecycle and callback URL parsing
   * @param url - Authorization URL to open
   * @param callbackScheme - Expected callback URL scheme (e.g., 'myapp://')
   * @returns Promise resolving to parsed callback parameters
   */
  openAuthWindow(url: string, callbackScheme: string): Promise<AuthCallbackResult>;

  /**
   * Get current URL (browser only)
   * @returns Current page URL or null if not in browser context
   */
  getCurrentURL(): string | null;

  /**
   * Get URL query parameters
   * @returns Record of query parameter key-value pairs
   */
  getURLParams(): Record<string, string>;

  /**
   * Add listener for URL/deep link changes
   * Optional - not all platforms support URL change listening
   * @param callback - Function called when URL changes
   * @returns Cleanup function to remove listener
   */
  addURLListener?(callback: (url: string) => void): () => void;
}

/**
 * Result from OAuth/auth callback
 */
export interface AuthCallbackResult {
  /** Authorization code from OAuth flow */
  code?: string;
  /** State parameter for CSRF protection */
  state?: string;
  /** Error code if authorization failed */
  error?: string;
  /** Human-readable error description */
  errorDescription?: string;
  /** Full message data for platform-specific payloads (e.g., wallet window results) */
  data?: unknown;
}

/**
 * Encoding/decoding operations adapter
 * Abstracts Buffer (Node.js) and browser encoding APIs
 */
export interface EncodingAdapter {
  /**
   * Convert Uint8Array to base64 string
   * @param bytes - Binary data to encode
   * @returns Base64 encoded string
   */
  bytesToBase64(bytes: Uint8Array): string;

  /**
   * Convert base64 string to Uint8Array
   * @param base64 - Base64 encoded string
   * @returns Decoded binary data
   */
  base64ToBytes(base64: string): Uint8Array;

  /**
   * Convert Uint8Array to hex string
   * @param bytes - Binary data to encode
   * @returns Lowercase hex string
   */
  bytesToHex(bytes: Uint8Array): string;

  /**
   * Convert hex string to Uint8Array
   * @param hex - Hex encoded string (case insensitive)
   * @returns Decoded binary data
   */
  hexToBytes(hex: string): Uint8Array;

  /**
   * Convert Uint8Array to UTF-8 string
   * @param bytes - UTF-8 encoded binary data
   * @returns Decoded string
   */
  bytesToUtf8(bytes: Uint8Array): string;

  /**
   * Convert UTF-8 string to Uint8Array
   * @param str - String to encode
   * @returns UTF-8 encoded binary data
   */
  utf8ToBytes(str: string): Uint8Array;
}

/**
 * Combined platform adapters
 * Single object containing all platform-specific implementations
 */
export interface PlatformAdapters {
  /** Cryptographic operations */
  crypto: CryptoAdapter;
  /** Persistent storage */
  storage: StorageAdapter;
  /** URL/linking operations */
  linking: LinkingAdapter;
  /** Encoding/decoding utilities */
  encoding: EncodingAdapter;
}
