import { crypto } from "../crypto";

// Mock external wallet SDKs
jest.mock("@meshsdk/wallet", () => ({
  MeshWallet: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    getAddresses: jest.fn().mockResolvedValue({
      baseAddressBech32:
        "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
    }),
  })),
}));

jest.mock("@meshsdk/common", () => ({
  generateMnemonic: jest.fn().mockResolvedValue(
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art",
  ),
}));

jest.mock("@meshsdk/core-cst", () => ({
  deserializeBech32Address: jest.fn().mockReturnValue({
    pubKeyHash: "mock-pub-key-hash",
    stakeCredentialHash: "mock-stake-credential-hash",
  }),
}));

jest.mock("@meshsdk/bitcoin", () => ({
  EmbeddedWallet: jest.fn().mockImplementation(() => ({
    getPublicKey: jest.fn().mockReturnValue("mock-bitcoin-pub-key-hash"),
    getAddress: jest.fn().mockResolvedValue("bc1q..."),
  })),
}));

jest.mock("@buildonspark/spark-sdk", () => ({
  SparkWallet: {
    initialize: jest.fn().mockResolvedValue({
      wallet: {
        getIdentityPublicKey: jest.fn().mockResolvedValue("mock-spark-pub-key"),
        getStaticDepositAddress: jest
          .fn()
          .mockResolvedValue("mock-spark-deposit-address"),
      },
    }),
  },
}));

// Import after mocks
import { clientGenerateWallet } from "./generate-wallet";
import { generateMnemonic } from "@meshsdk/common";
import { MeshWallet } from "@meshsdk/wallet";
import { EmbeddedWallet } from "@meshsdk/bitcoin";
import { SparkWallet } from "@buildonspark/spark-sdk";
import { decryptWithCipher } from "../crypto";
import { hexToBytes, bytesToString } from "../convertors";
import { shamirCombine } from "../key-shard";

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

describe("clientGenerateWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a wallet and returns all required fields", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    expect(result).toHaveProperty("encryptedDeviceShard");
    expect(result).toHaveProperty("authShard");
    expect(result).toHaveProperty("encryptedRecoveryShard");
    expect(result).toHaveProperty("bitcoinMainnetPubKeyHash");
    expect(result).toHaveProperty("bitcoinTestnetPubKeyHash");
    expect(result).toHaveProperty("cardanoPubKeyHash");
    expect(result).toHaveProperty("cardanoStakeCredentialHash");
    expect(result).toHaveProperty("sparkMainnetPubKeyHash");
    expect(result).toHaveProperty("sparkRegtestPubKeyHash");
    expect(result).toHaveProperty("sparkMainnetStaticDepositAddress");
    expect(result).toHaveProperty("sparkRegtestStaticDepositAddress");
  });

  it("calls generateMnemonic with 256 bits", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    await clientGenerateWallet(deviceKey, recoveryKey);

    expect(generateMnemonic).toHaveBeenCalledWith(256);
  });

  it("returns encrypted device shard as JSON string", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    expect(typeof result.encryptedDeviceShard).toBe("string");
    const parsed = JSON.parse(result.encryptedDeviceShard);
    expect(parsed).toHaveProperty("iv");
    expect(parsed).toHaveProperty("ciphertext");
  });

  it("returns encrypted recovery shard as JSON string", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    expect(typeof result.encryptedRecoveryShard).toBe("string");
    const parsed = JSON.parse(result.encryptedRecoveryShard);
    expect(parsed).toHaveProperty("iv");
    expect(parsed).toHaveProperty("ciphertext");
  });

  it("returns authShard as hex string", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    expect(typeof result.authShard).toBe("string");
    expect(result.authShard).toMatch(/^[0-9a-f]+$/);
  });

  it("device shard can be decrypted with device key", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    const decrypted = await decryptWithCipher({
      encryptedDataJSON: result.encryptedDeviceShard,
      key: deviceKey,
    });

    expect(typeof decrypted).toBe("string");
    expect(decrypted).toMatch(/^[0-9a-f]+$/); // Should be hex-encoded shard
  });

  it("recovery shard can be decrypted with recovery key", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    const decrypted = await decryptWithCipher({
      encryptedDataJSON: result.encryptedRecoveryShard,
      key: recoveryKey,
    });

    expect(typeof decrypted).toBe("string");
    expect(decrypted).toMatch(/^[0-9a-f]+$/); // Should be hex-encoded shard
  });

  it("device shard cannot be decrypted with wrong key", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");
    const wrongKey = await deriveKeyFromPassword("wrong-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    await expect(
      decryptWithCipher({
        encryptedDataJSON: result.encryptedDeviceShard,
        key: wrongKey,
      }),
    ).rejects.toThrow();
  });

  it("creates EmbeddedWallet for both testnet and mainnet", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    await clientGenerateWallet(deviceKey, recoveryKey);

    expect(EmbeddedWallet).toHaveBeenCalledTimes(2);
    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({ network: "Testnet" }),
    );
    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({ network: "Mainnet" }),
    );
  });

  it("creates MeshWallet with networkId 1", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    await clientGenerateWallet(deviceKey, recoveryKey);

    expect(MeshWallet).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 1 }),
    );
  });

  it("initializes SparkWallet for both mainnet and regtest", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    await clientGenerateWallet(deviceKey, recoveryKey);

    expect(SparkWallet.initialize).toHaveBeenCalledTimes(2);
    expect(SparkWallet.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ network: "MAINNET" }),
      }),
    );
    expect(SparkWallet.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ network: "REGTEST" }),
      }),
    );
  });

  it("returns bitcoin pub key hashes", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    expect(result.bitcoinMainnetPubKeyHash).toBe("mock-bitcoin-pub-key-hash");
    expect(result.bitcoinTestnetPubKeyHash).toBe("mock-bitcoin-pub-key-hash");
  });

  it("returns cardano key hashes", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    expect(result.cardanoPubKeyHash).toBe("mock-pub-key-hash");
    expect(result.cardanoStakeCredentialHash).toBe(
      "mock-stake-credential-hash",
    );
  });

  it("returns spark pub key hashes and deposit addresses", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    expect(result.sparkMainnetPubKeyHash).toBe("mock-spark-pub-key");
    expect(result.sparkRegtestPubKeyHash).toBe("mock-spark-pub-key");
    expect(result.sparkMainnetStaticDepositAddress).toBe(
      "mock-spark-deposit-address",
    );
    expect(result.sparkRegtestStaticDepositAddress).toBe(
      "mock-spark-deposit-address",
    );
  });

  it("2 of 3 shards can reconstruct the mnemonic", async () => {
    const deviceKey = await deriveKeyFromPassword("device-password");
    const recoveryKey = await deriveKeyFromPassword("recovery-password");

    const result = await clientGenerateWallet(deviceKey, recoveryKey);

    // Decrypt device shard (shard 1)
    const shard1 = await decryptWithCipher({
      encryptedDataJSON: result.encryptedDeviceShard,
      key: deviceKey,
    });

    // Auth shard is shard 2 (unencrypted hex)
    const shard2 = result.authShard;

    // Combine shards 1 and 2
    const share1 = hexToBytes(shard1);
    const share2 = hexToBytes(shard2);
    const reconstructed = await shamirCombine([share1, share2]);
    const mnemonic = bytesToString(reconstructed);

    // Should match the mock mnemonic
    expect(mnemonic).toBe(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art",
    );
  });
});
