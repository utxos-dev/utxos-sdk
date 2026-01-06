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

async function deriveKeyFromPassword(password: string): Promise<CryptoKey> {
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
    ["encrypt", "decrypt"],
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
    console.log("encryptedDataJSON", encryptedDataJSON);

    const decrypted = await decryptWithCipher({
      encryptedDataJSON: encryptedDataJSON,
      key,
    });

    expect(data).toBe(decrypted);
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
});
