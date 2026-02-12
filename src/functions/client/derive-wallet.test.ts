import { crypto } from "../crypto";
import { encryptWithCipher } from "../crypto";
import { spiltKeyIntoShards } from "../key-shard";

// Mock external wallet SDKs
const mockCardanoWalletInstance = {
  getUsedAddressesBech32: jest.fn().mockResolvedValue(["addr_test1..."]),
};

jest.mock("@meshsdk/wallet", () => ({
  MeshCardanoHeadlessWallet: {
    fromMnemonic: jest.fn().mockResolvedValue(mockCardanoWalletInstance),
  },
}));

jest.mock("@meshsdk/bitcoin", () => ({
  EmbeddedWallet: jest.fn().mockImplementation(() => ({
    getAddress: jest.fn().mockResolvedValue("bc1q..."),
  })),
}));

jest.mock("@buildonspark/spark-sdk", () => ({
  SparkWallet: {
    initialize: jest.fn().mockResolvedValue({
      wallet: {
        getAddress: jest.fn().mockResolvedValue("spark1..."),
      },
    }),
  },
}));

// Import after mocks
import { clientDeriveWallet } from "./derive-wallet";
import { MeshCardanoHeadlessWallet } from "@meshsdk/wallet";
import { EmbeddedWallet } from "@meshsdk/bitcoin";
import { SparkWallet } from "@buildonspark/spark-sdk";

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

describe("clientDeriveWallet", () => {
  const testMnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("derives wallet from encrypted device shard and custodial shard", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");

    // Encrypt the device shard (shard 1)
    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: deviceKey,
    });

    // Custodial shard is shard 2 (auth shard)
    const custodialShard = shards[1]!;

    const result = await clientDeriveWallet(
      encryptedDeviceShard,
      deviceKey,
      custodialShard,
      0, // testnet
    );

    expect(result).toHaveProperty("bitcoinWallet");
    expect(result).toHaveProperty("cardanoWallet");
    expect(result).toHaveProperty("sparkWallet");
    expect(result).toHaveProperty("key");
  });

  it("returns the reconstructed mnemonic as key", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");

    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: deviceKey,
    });

    const result = await clientDeriveWallet(
      encryptedDeviceShard,
      deviceKey,
      shards[1]!,
      0,
    );

    expect(result.key).toBe(testMnemonic);
  });

  it("creates wallets with testnet configuration when networkId is 0", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");

    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: deviceKey,
    });

    await clientDeriveWallet(encryptedDeviceShard, deviceKey, shards[1]!, 0);

    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({ network: "Testnet" }),
    );
    expect(MeshCardanoHeadlessWallet.fromMnemonic).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 0 }),
    );
    expect(SparkWallet.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ network: "REGTEST" }),
      }),
    );
  });

  it("creates wallets with mainnet configuration when networkId is 1", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");

    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: deviceKey,
    });

    await clientDeriveWallet(encryptedDeviceShard, deviceKey, shards[1]!, 1);

    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({ network: "Mainnet" }),
    );
    expect(MeshCardanoHeadlessWallet.fromMnemonic).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 1 }),
    );
    expect(SparkWallet.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ network: "MAINNET" }),
      }),
    );
  });

  it("passes bitcoinProvider when provided", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");
    const mockProvider = { getUtxos: jest.fn() };

    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: deviceKey,
    });

    await clientDeriveWallet(
      encryptedDeviceShard,
      deviceKey,
      shards[1]!,
      0,
      mockProvider as any,
    );

    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({ provider: mockProvider }),
    );
  });

  it("fails with wrong decryption key", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const correctKey = await deriveKeyFromPassword("correct-password");
    const wrongKey = await deriveKeyFromPassword("wrong-password");

    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: correctKey,
    });

    await expect(
      clientDeriveWallet(encryptedDeviceShard, wrongKey, shards[1]!, 0),
    ).rejects.toThrow();
  });

  it("fails with corrupted encrypted shard", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");

    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: deviceKey,
    });

    // Corrupt the encrypted data
    const parsed = JSON.parse(encryptedDeviceShard);
    parsed.ciphertext = "corrupted" + parsed.ciphertext;

    await expect(
      clientDeriveWallet(JSON.stringify(parsed), deviceKey, shards[1]!, 0),
    ).rejects.toThrow();
  });

  it("fails with invalid JSON in encrypted shard", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");

    await expect(
      clientDeriveWallet("not-valid-json", deviceKey, shards[1]!, 0),
    ).rejects.toThrow();
  });

  it("works with shards from different positions", async () => {
    const shards = await spiltKeyIntoShards(testMnemonic);
    const deviceKey = await deriveKeyFromPassword("device-password");

    // Use shard 2 as device shard and shard 3 as custodial
    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[1]!,
      key: deviceKey,
    });

    const result = await clientDeriveWallet(
      encryptedDeviceShard,
      deviceKey,
      shards[2]!,
      0,
    );

    expect(result.key).toBe(testMnemonic);
  });

});

describe("clientDeriveWallet with 24-word mnemonic", () => {
  const mnemonic24 =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

  it("derives wallet from 24-word mnemonic shards", async () => {
    const shards = await spiltKeyIntoShards(mnemonic24);
    const deviceKey = await deriveKeyFromPassword("device-password");

    const encryptedDeviceShard = await encryptWithCipher({
      data: shards[0]!,
      key: deviceKey,
    });

    const result = await clientDeriveWallet(
      encryptedDeviceShard,
      deviceKey,
      shards[1]!,
      0,
    );

    expect(result.key).toBe(mnemonic24);
    expect(result.key.split(" ").length).toBe(24);
  });
});
