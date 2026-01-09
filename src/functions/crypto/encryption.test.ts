import { crypto } from ".";
import {
  decryptWithCipher,
  decryptWithPrivateKey,
  encryptWithCipher,
  encryptWithPublicKey,
  generateKeyPair,
} from "./encryption";

const data =
  "solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution solution";

async function deriveKeyFromPassword(
  password: string,
  usages: KeyUsage[] = ["encrypt", "decrypt"],
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("static-salt-for-test"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

describe("with cipher", () => {
  const keyString = "01234567890123456789";

  it("encrypt and decrypt", async () => {
    const key = await deriveKeyFromPassword(keyString);
    const encryptedDataJSON = await encryptWithCipher({
      data,
      key,
    });

    const decrypted = await decryptWithCipher({
      encryptedDataJSON: encryptedDataJSON,
      key,
    });

    expect(data).toBe(decrypted);
  });

  it("encrypts empty string", async () => {
    const key = await deriveKeyFromPassword(keyString);
    const encryptedDataJSON = await encryptWithCipher({
      data: "",
      key,
    });
    const decrypted = await decryptWithCipher({
      encryptedDataJSON,
      key,
    });
    expect(decrypted).toBe("");
  });

  it("encrypts unicode characters", async () => {
    const key = await deriveKeyFromPassword(keyString);
    const unicodeData = "Hello 日本語 🎉";
    const encryptedDataJSON = await encryptWithCipher({
      data: unicodeData,
      key,
    });
    const decrypted = await decryptWithCipher({
      encryptedDataJSON,
      key,
    });
    expect(decrypted).toBe(unicodeData);
  });

  it("produces different ciphertext for same input (due to random IV)", async () => {
    const key = await deriveKeyFromPassword(keyString);
    const encrypted1 = await encryptWithCipher({ data, key });
    const encrypted2 = await encryptWithCipher({ data, key });
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = await deriveKeyFromPassword("password1");
    const key2 = await deriveKeyFromPassword("password2");
    const encryptedDataJSON = await encryptWithCipher({
      data,
      key: key1,
    });
    await expect(
      decryptWithCipher({ encryptedDataJSON, key: key2 }),
    ).rejects.toThrow();
  });

  it("fails to decrypt corrupted ciphertext", async () => {
    const key = await deriveKeyFromPassword(keyString);
    const encryptedDataJSON = await encryptWithCipher({ data, key });
    const parsed = JSON.parse(encryptedDataJSON);
    parsed.ciphertext = "corrupted" + parsed.ciphertext;
    await expect(
      decryptWithCipher({ encryptedDataJSON: JSON.stringify(parsed), key }),
    ).rejects.toThrow();
  });

  it("fails to decrypt with corrupted IV", async () => {
    const key = await deriveKeyFromPassword(keyString);
    const encryptedDataJSON = await encryptWithCipher({ data, key });
    const parsed = JSON.parse(encryptedDataJSON);
    parsed.iv = "AAAAAAAAAAAAAAAAAAAAAA=="; // Different IV
    await expect(
      decryptWithCipher({ encryptedDataJSON: JSON.stringify(parsed), key }),
    ).rejects.toThrow();
  });

  it("fails to decrypt invalid JSON", async () => {
    const key = await deriveKeyFromPassword(keyString);
    await expect(
      decryptWithCipher({ encryptedDataJSON: "not valid json", key }),
    ).rejects.toThrow();
  });

  it("handles large data", async () => {
    const key = await deriveKeyFromPassword(keyString);
    const largeData = "x".repeat(100000);
    const encryptedDataJSON = await encryptWithCipher({
      data: largeData,
      key,
    });
    const decrypted = await decryptWithCipher({
      encryptedDataJSON,
      key,
    });
    expect(decrypted).toBe(largeData);
  });
});

describe("with keypair", () => {
  it("generate, encrypt, decrypt", async () => {
    const { publicKey, privateKey } = await generateKeyPair();

    const encryptedDataJSON = await encryptWithPublicKey({ publicKey, data });

    const decrypted = await decryptWithPrivateKey({
      privateKey,
      encryptedDataJSON,
    });

    expect(data).toBe(decrypted);
  });

  it("generates unique keypairs", async () => {
    const keyPair1 = await generateKeyPair();
    const keyPair2 = await generateKeyPair();
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
  });

  it("encrypts empty string", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const encryptedDataJSON = await encryptWithPublicKey({
      publicKey,
      data: "",
    });
    const decrypted = await decryptWithPrivateKey({
      privateKey,
      encryptedDataJSON,
    });
    expect(decrypted).toBe("");
  });

  it("encrypts unicode characters", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const unicodeData = "Hello 世界 🌍";
    const encryptedDataJSON = await encryptWithPublicKey({
      publicKey,
      data: unicodeData,
    });
    const decrypted = await decryptWithPrivateKey({
      privateKey,
      encryptedDataJSON,
    });
    expect(decrypted).toBe(unicodeData);
  });

  it("produces different ciphertext for same input (ephemeral key)", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const encrypted1 = await encryptWithPublicKey({ publicKey, data });
    const encrypted2 = await encryptWithPublicKey({ publicKey, data });
    expect(encrypted1).not.toBe(encrypted2);
    // Both should decrypt to same value
    const decrypted1 = await decryptWithPrivateKey({
      privateKey,
      encryptedDataJSON: encrypted1,
    });
    const decrypted2 = await decryptWithPrivateKey({
      privateKey,
      encryptedDataJSON: encrypted2,
    });
    expect(decrypted1).toBe(data);
    expect(decrypted2).toBe(data);
  });

  it("fails to decrypt with wrong private key", async () => {
    const keyPair1 = await generateKeyPair();
    const keyPair2 = await generateKeyPair();
    const encryptedDataJSON = await encryptWithPublicKey({
      publicKey: keyPair1.publicKey,
      data,
    });
    await expect(
      decryptWithPrivateKey({
        privateKey: keyPair2.privateKey,
        encryptedDataJSON,
      }),
    ).rejects.toThrow();
  });

  it("fails to decrypt with invalid private key format", async () => {
    const { publicKey } = await generateKeyPair();
    const encryptedDataJSON = await encryptWithPublicKey({ publicKey, data });
    await expect(
      decryptWithPrivateKey({
        privateKey: "not-a-valid-key",
        encryptedDataJSON,
      }),
    ).rejects.toThrow();
  });

  it("fails to encrypt with invalid public key format", async () => {
    await expect(
      encryptWithPublicKey({
        publicKey: "not-a-valid-key",
        data,
      }),
    ).rejects.toThrow();
  });

  it("fails to decrypt corrupted ciphertext", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const encryptedDataJSON = await encryptWithPublicKey({ publicKey, data });
    const parsed = JSON.parse(encryptedDataJSON);
    parsed.ciphertext = "corrupted" + parsed.ciphertext;
    await expect(
      decryptWithPrivateKey({
        privateKey,
        encryptedDataJSON: JSON.stringify(parsed),
      }),
    ).rejects.toThrow();
  });

  it("fails to decrypt invalid JSON", async () => {
    const { privateKey } = await generateKeyPair();
    await expect(
      decryptWithPrivateKey({
        privateKey,
        encryptedDataJSON: "not valid json",
      }),
    ).rejects.toThrow();
  });

  it("handles large data", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const largeData = "y".repeat(50000);
    const encryptedDataJSON = await encryptWithPublicKey({
      publicKey,
      data: largeData,
    });
    const decrypted = await decryptWithPrivateKey({
      privateKey,
      encryptedDataJSON,
    });
    expect(decrypted).toBe(largeData);
  });
});

describe("generateKeyPair", () => {
  it("returns base64 encoded keys", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    // Base64 strings should not throw when decoded
    expect(() => Buffer.from(publicKey, "base64")).not.toThrow();
    expect(() => Buffer.from(privateKey, "base64")).not.toThrow();
  });

  it("generates keys of expected format (SPKI for public, PKCS8 for private)", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    // SPKI encoded P-256 public keys are typically 91 bytes -> ~122 base64 chars
    // PKCS8 encoded P-256 private keys are typically 138 bytes -> ~184 base64 chars
    expect(publicKey.length).toBeGreaterThan(100);
    expect(privateKey.length).toBeGreaterThan(150);
  });
});
