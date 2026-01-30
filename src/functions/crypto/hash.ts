import { getCrypto, getEncoding } from '../../internal/platform-context';

/**
 * Convert algorithm name from Node.js format to Web Crypto format
 * e.g., "sha256" -> "SHA-256", "sha512" -> "SHA-512"
 */
function normalizeAlgorithm(algorithm: string): string {
  const upper = algorithm.toUpperCase();
  // Handle common formats: sha256, SHA256, sha-256, SHA-256
  if (upper.startsWith('SHA') && !upper.includes('-')) {
    // Insert hyphen before number: SHA256 -> SHA-256
    return upper.replace(/^SHA(\d+)$/, 'SHA-$1');
  }
  return upper;
}

export function generateHash({
  size = 64,
}: {
  size?: number;
}): Promise<string> {
  return new Promise((resolve) => {
    const bytes = getCrypto().getRandomBytes(size);
    resolve(getEncoding().bytesToHex(bytes));
  });
}

export async function hashData({
  data,
  privateKey = "",
  algorithm = "sha256",
}: {
  data: any;
  privateKey?: string;
  algorithm?: string;
}): Promise<string> {
  const encoding = getEncoding();
  const crypto = getCrypto();

  // Convert string data to bytes
  const dataBytes = typeof data === 'string'
    ? encoding.utf8ToBytes(data)
    : encoding.utf8ToBytes(String(data));

  // Convert key to bytes
  const keyBytes = encoding.utf8ToBytes(privateKey);

  // Normalize algorithm name for Web Crypto API
  const normalizedAlgorithm = normalizeAlgorithm(algorithm);

  // Perform HMAC signing
  const signatureBytes = await crypto.hmacSign(normalizedAlgorithm, keyBytes, dataBytes);

  // Convert result to hex string
  return encoding.bytesToHex(signatureBytes);
}
