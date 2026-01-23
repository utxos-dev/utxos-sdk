import { crypto } from "../crypto";
import { encryptWithCipher, decryptWithCipher } from "../crypto";
import { spiltKeyIntoShards } from "../key-shard";
import { hexToBytes, bytesToString } from "../convertors";
import { shamirCombine } from "../key-shard";

// Mock external wallet SDKs
jest.mock("@meshsdk/wallet", () => ({
  MeshWallet: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@meshsdk/bitcoin", () => ({
  EmbeddedWallet: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@buildonspark/spark-sdk", () => ({
  SparkWallet: {
    initialize: jest.fn().mockResolvedValue({
      wallet: {},
    }),
  },
}));

// Import after mocks
import { clientRecovery } from "./recovery";

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

describe("clientRecovery", () => {
  const testMnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("recovers wallet from auth shard and encrypted recovery shard", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    // Auth shard is shard 2
    const authShard = shards[1]!;

    // Recovery shard is shard 3, encrypted
    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      authShard,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    expect(result).toHaveProperty("deviceShard");
    expect(result).toHaveProperty("authShard");
    expect(result).toHaveProperty("fullKey");
  });

  it("returns the original mnemonic as fullKey", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    expect(result.fullKey).toBe(testMnemonic);
  });

  it("returns new device shard encrypted with new key", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    // Device shard should be decryptable with new device key
    expect(typeof result.deviceShard).toBe("string");
    const decrypted = await decryptWithCipher({
      encryptedDataJSON: result.deviceShard,
      key: newDeviceKey,
    });
    expect(decrypted).toMatch(/^[0-9a-f]+$/); // hex-encoded shard
  });

  it("returns new auth shard as hex string", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    expect(typeof result.authShard).toBe("string");
    expect(result.authShard).toMatch(/^[0-9a-f]+$/);
  });

  it("new shards can reconstruct the original mnemonic", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    // Decrypt new device shard
    const newShard1 = await decryptWithCipher({
      encryptedDataJSON: result.deviceShard,
      key: newDeviceKey,
    });
    const newShard2 = result.authShard;

    // Combine new shards
    const share1 = hexToBytes(newShard1);
    const share2 = hexToBytes(newShard2);
    const reconstructed = await shamirCombine([share1, share2]);
    const mnemonic = bytesToString(reconstructed);

    expect(mnemonic).toBe(testMnemonic);
  });

  it("device shard cannot be decrypted with wrong key", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");
    const wrongKey = await deriveKeyFromPassword("wrong-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    await expect(
      decryptWithCipher({
        encryptedDataJSON: result.deviceShard,
        key: wrongKey,
      }),
    ).rejects.toThrow();
  });

  it("throws with wrong recovery key", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const shards = await spiltKeyIntoShards(testMnemonic);
    const correctRecoveryKey = await deriveKeyFromPassword("recovery-password");
    const wrongRecoveryKey = await deriveKeyFromPassword("wrong-recovery");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: correctRecoveryKey,
    });

    await expect(
      clientRecovery(
        shards[1]!,
        encryptedRecoveryShard,
        wrongRecoveryKey,
        newDeviceKey,
      ),
    ).rejects.toThrow("Invalid recovery answer");
    consoleSpy.mockRestore();
  });

  it("throws with corrupted recovery shard", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    // Corrupt the encrypted data
    const parsed = JSON.parse(encryptedRecoveryShard);
    parsed.ciphertext = "corrupted" + parsed.ciphertext;

    await expect(
      clientRecovery(
        shards[1]!,
        JSON.stringify(parsed),
        recoveryKey,
        newDeviceKey,
      ),
    ).rejects.toThrow("Invalid recovery answer");
    consoleSpy.mockRestore();
  });

  it("throws with invalid auth shard", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    await expect(
      clientRecovery(
        "invalid-hex!@#",
        encryptedRecoveryShard,
        recoveryKey,
        newDeviceKey,
      ),
    ).rejects.toThrow("Invalid recovery answer");
    consoleSpy.mockRestore();
  });

  it("throws with invalid JSON in recovery shard", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    await expect(
      clientRecovery(shards[1]!, "not-valid-json", recoveryKey, newDeviceKey),
    ).rejects.toThrow("Invalid recovery answer");
    consoleSpy.mockRestore();
  });
});

describe("clientRecovery with 24-word mnemonic", () => {
  const mnemonic24 =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

  it("recovers 24-word mnemonic", async () => {
    const shards = await spiltKeyIntoShards(mnemonic24);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    expect(result.fullKey).toBe(mnemonic24);
    expect(result.fullKey.split(" ").length).toBe(24);
  });
});

describe("clientRecovery generates new shards", () => {
  const testMnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  it("generates different shards than original", async () => {
    const originalShards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey = await deriveKeyFromPassword("new-device-password");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: originalShards[2]!,
      key: recoveryKey,
    });

    const result = await clientRecovery(
      originalShards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey,
    );

    // New auth shard should be different from original (due to re-splitting)
    // Note: There's a tiny probability they could be the same, but it's negligible
    expect(result.authShard).not.toBe(originalShards[1]);
  });

  it("recovery can be performed multiple times", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const newDeviceKey1 = await deriveKeyFromPassword("new-device-1");
    const newDeviceKey2 = await deriveKeyFromPassword("new-device-2");

    const encryptedRecoveryShard = await encryptWithCipher({
      data: shards[2]!,
      key: recoveryKey,
    });

    const result1 = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey1,
    );

    const result2 = await clientRecovery(
      shards[1]!,
      encryptedRecoveryShard,
      recoveryKey,
      newDeviceKey2,
    );

    // Both should recover the same mnemonic
    expect(result1.fullKey).toBe(testMnemonic);
    expect(result2.fullKey).toBe(testMnemonic);

    // But device shards should be encrypted with different keys
    await expect(
      decryptWithCipher({
        encryptedDataJSON: result1.deviceShard,
        key: newDeviceKey2,
      }),
    ).rejects.toThrow();
  });
});
