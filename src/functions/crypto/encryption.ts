import { crypto } from ".";
import { getEncoding } from "../../internal/platform-context";

const IV_LENGTH = 16;

export async function encryptWithCipher({
  data,
  key,
  algorithm = "AES-GCM",
  initializationVectorSize = IV_LENGTH,
}: {
  data: string;
  key: CryptoKey;
  algorithm?: string;
  initializationVectorSize?: number;
}) {
  // Create an initialization vector
  const iv = crypto.getRandomValues(new Uint8Array(initializationVectorSize));

  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: algorithm, iv },
    key,
    new TextEncoder().encode(data),
  );

  // Return the encrypted data as a base64 string
  const encoding = getEncoding();
  return JSON.stringify({
    iv: encoding.bytesToBase64(new Uint8Array(iv)),
    ciphertext: encoding.bytesToBase64(new Uint8Array(encrypted)),
  });
}
export async function decryptWithCipher({
  encryptedDataJSON,
  key,
  algorithm = "AES-GCM",
}: {
  encryptedDataJSON: string;
  key: CryptoKey;
  algorithm?: string;
}) {
  const _encryptedData: {
    iv: string;
    ciphertext: string;
  } = JSON.parse(encryptedDataJSON);

  // Decode the IV and encrypted data from base64
  const encoding = getEncoding();
  const decodedIv = encoding.base64ToBytes(_encryptedData.iv);
  const decodedEncryptedData = encoding.base64ToBytes(_encryptedData.ciphertext);

  // Decrypt the data (slice creates fresh Uint8Array for type compatibility)
  const decrypted = await crypto.subtle.decrypt(
    { name: algorithm, iv: decodedIv.slice() },
    key,
    decodedEncryptedData.slice(),
  );

  // Return the decrypted data as a string
  return new TextDecoder().decode(decrypted);
}

export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"],
  );

  const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const encoding = getEncoding();
  const key = {
    publicKey: encoding.bytesToBase64(new Uint8Array(publicKey)),
    privateKey: encoding.bytesToBase64(new Uint8Array(privateKey)),
  };

  return key;
}

export async function encryptWithPublicKey({
  publicKey,
  data,
}: {
  publicKey: string;
  data: string;
}) {
  const encoding = getEncoding();
  const publicKeyBuffer = encoding.base64ToBytes(publicKey);

  const _publicKey = await crypto.subtle.importKey(
    "spki",
    publicKeyBuffer.slice(),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Generate an ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );

  // Derive a shared secret
  const sharedSecret = await crypto.subtle.deriveKey(
    { name: "ECDH", public: _publicKey },
    ephemeralKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  // Encrypt the message using AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedSecret,
    new TextEncoder().encode(data),
  );

  const encryptedData = {
    ephemeralPublicKey: await crypto.subtle.exportKey(
      "spki",
      ephemeralKeyPair.publicKey,
    ),
    iv,
    ciphertext: encrypted,
  };

  return JSON.stringify({
    ephemeralPublicKey: encoding.bytesToBase64(new Uint8Array(encryptedData.ephemeralPublicKey)),
    iv: encoding.bytesToBase64(new Uint8Array(encryptedData.iv)),
    ciphertext: encoding.bytesToBase64(new Uint8Array(encryptedData.ciphertext)),
  });
}

export async function decryptWithPrivateKey({
  privateKey,
  encryptedDataJSON,
}: {
  privateKey: string;
  encryptedDataJSON: string;
}) {
  const encoding = getEncoding();
  const privateKeyBuffer = encoding.base64ToBytes(privateKey);

  const _encryptedData: {
    ephemeralPublicKey: string;
    iv: string;
    ciphertext: string;
  } = JSON.parse(encryptedDataJSON);

  const encryptedData = {
    ephemeralPublicKey: encoding.base64ToBytes(_encryptedData.ephemeralPublicKey),
    iv: encoding.base64ToBytes(_encryptedData.iv),
    ciphertext: encoding.base64ToBytes(_encryptedData.ciphertext),
  };

  const _privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer.slice(),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );

  const ephemeralPublicKey = await crypto.subtle.importKey(
    "spki",
    encryptedData.ephemeralPublicKey.slice(),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Derive the shared secret
  const sharedSecret = await crypto.subtle.deriveKey(
    { name: "ECDH", public: ephemeralPublicKey },
    _privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  // Decrypt the message (slice creates fresh Uint8Array for type compatibility)
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encryptedData.iv.slice() },
    sharedSecret,
    encryptedData.ciphertext.slice(),
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * these methods do not use crypto.subtle
 */

// export function encryptWithCipher({
//   data,
//   key,
//   algorithm = "aes-256-ctr",
//   initializationVectorSize = IV_LENGTH,
// }: {
//   data: any;
//   key: string;
//   algorithm?: string;
//   initializationVectorSize?: number;
// }) {
//   const _key = crypto
//     .createHash("sha256")
//     .update(String(key))
//     .digest("base64")
//     .substr(0, 32);

//   const buffer = Buffer.from(data);

//   // Create an initialization vector
//   const iv = crypto.randomBytes(initializationVectorSize);
//   // Create a new cipher using the algorithm, key, and iv
//   const cipher = crypto.createCipheriv(algorithm, _key, iv);
//   // Create the new (encrypted) buffer
//   const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);

//   return result.toString("base64");
// }

// export function decryptWithCipher({
//   encryptedData,
//   key,
//   algorithm = "aes-256-ctr",
//   initializationVectorSize = 16,
// }: {
//   encryptedData: string;
//   key: string;
//   algorithm?: string;
//   initializationVectorSize?: number;
// }) {
//   key = crypto
//     .createHash("sha256")
//     .update(String(key))
//     .digest("base64")
//     .substr(0, 32);

//   let buffer = Buffer.from(encryptedData, "base64");

//   // Get the iv: the first 16 bytes
//   const iv = buffer.slice(0, initializationVectorSize);
//   // Get the rest
//   buffer = buffer.slice(initializationVectorSize);
//   // Create a decipher
//   const decipher = crypto.createDecipheriv(algorithm, key, iv);
//   // Actually decrypt it
//   const result = Buffer.concat([decipher.update(buffer), decipher.final()]);

//   return result.toString("utf8");
// }
