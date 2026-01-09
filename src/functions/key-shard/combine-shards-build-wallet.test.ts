import { spiltKeyIntoShards } from "./spilt-key-into-shards";
import { hexToBytes, bytesToString } from "../convertors";
import { shamirCombine } from "./shamir-secret-sharing";

// Mock external wallet SDKs
jest.mock("@meshsdk/wallet", () => ({
  MeshWallet: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    getUsedAddresses: jest.fn().mockResolvedValue(["addr_test1..."]),
  })),
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

// Import after mocks are set up
import { combineShardsBuildWallet } from "./combine-shards-build-wallet";
import { MeshWallet } from "@meshsdk/wallet";
import { EmbeddedWallet } from "@meshsdk/bitcoin";
import { SparkWallet } from "@buildonspark/spark-sdk";

describe("combineShardsBuildWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reconstructs mnemonic from 2 shards and creates wallets", async () => {
    const originalMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(originalMnemonic);

    const result = await combineShardsBuildWallet(0, shards[0]!, shards[1]!);

    expect(result.key).toBe(originalMnemonic);
    expect(result.bitcoinWallet).toBeDefined();
    expect(result.cardanoWallet).toBeDefined();
    expect(result.sparkWallet).toBeDefined();
  });

  it("works with any 2-of-3 shard combination", async () => {
    const mnemonic =
      "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong";
    const shards = await spiltKeyIntoShards(mnemonic);

    // Test all combinations
    const result1 = await combineShardsBuildWallet(0, shards[0]!, shards[1]!);
    const result2 = await combineShardsBuildWallet(0, shards[0]!, shards[2]!);
    const result3 = await combineShardsBuildWallet(0, shards[1]!, shards[2]!);

    expect(result1.key).toBe(mnemonic);
    expect(result2.key).toBe(mnemonic);
    expect(result3.key).toBe(mnemonic);
  });

  it("initializes EmbeddedWallet with correct network for testnet", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    await combineShardsBuildWallet(0, shards[0]!, shards[1]!);

    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "Testnet",
        key: expect.objectContaining({
          type: "mnemonic",
          words: mnemonic.split(" "),
        }),
      }),
    );
  });

  it("initializes EmbeddedWallet with correct network for mainnet", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    await combineShardsBuildWallet(1, shards[0]!, shards[1]!);

    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "Mainnet",
        key: expect.objectContaining({
          type: "mnemonic",
          words: mnemonic.split(" "),
        }),
      }),
    );
  });

  it("initializes MeshWallet with correct networkId for testnet", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    await combineShardsBuildWallet(0, shards[0]!, shards[1]!);

    expect(MeshWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 0,
        key: expect.objectContaining({
          type: "mnemonic",
          words: mnemonic.split(" "),
        }),
      }),
    );
  });

  it("initializes MeshWallet with correct networkId for mainnet", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    await combineShardsBuildWallet(1, shards[0]!, shards[1]!);

    expect(MeshWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 1,
        key: expect.objectContaining({
          type: "mnemonic",
          words: mnemonic.split(" "),
        }),
      }),
    );
  });

  it("initializes SparkWallet with REGTEST for testnet", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    await combineShardsBuildWallet(0, shards[0]!, shards[1]!);

    expect(SparkWallet.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        mnemonicOrSeed: mnemonic,
        options: expect.objectContaining({
          network: "REGTEST",
        }),
      }),
    );
  });

  it("initializes SparkWallet with MAINNET for mainnet", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    await combineShardsBuildWallet(1, shards[0]!, shards[1]!);

    expect(SparkWallet.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        mnemonicOrSeed: mnemonic,
        options: expect.objectContaining({
          network: "MAINNET",
        }),
      }),
    );
  });

  it("calls cardanoWallet.init()", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    const result = await combineShardsBuildWallet(0, shards[0]!, shards[1]!);

    expect(result.cardanoWallet.init).toHaveBeenCalled();
  });

  it("passes bitcoinProvider to EmbeddedWallet when provided", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);
    const mockProvider = { getUtxos: jest.fn() };

    await combineShardsBuildWallet(
      0,
      shards[0]!,
      shards[1]!,
      mockProvider as any,
    );

    expect(EmbeddedWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: mockProvider,
      }),
    );
  });

  it("handles 24-word mnemonic", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
    const shards = await spiltKeyIntoShards(mnemonic);

    const result = await combineShardsBuildWallet(0, shards[0]!, shards[2]!);

    expect(result.key).toBe(mnemonic);
    expect(result.key.split(" ").length).toBe(24);
  });
});

describe("combineShardsBuildWallet error cases", () => {
  it("fails with invalid hex shards", async () => {
    await expect(
      combineShardsBuildWallet(0, "invalid-hex!", "also-invalid!"),
    ).rejects.toThrow();
  });

  it("fails with mismatched shard lengths", async () => {
    const mnemonic1 = "short";
    const mnemonic2 = "much longer mnemonic phrase here";
    const shards1 = await spiltKeyIntoShards(mnemonic1);
    const shards2 = await spiltKeyIntoShards(mnemonic2);

    await expect(
      combineShardsBuildWallet(0, shards1[0]!, shards2[1]!),
    ).rejects.toThrow("all shares must have the same byte length");
  });

  it("fails with shards from different secrets of same length", async () => {
    // Both mnemonics have same byte length but different content
    const mnemonic1 =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const mnemonic2 =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon actor";
    const shards1 = await spiltKeyIntoShards(mnemonic1);
    const shards2 = await spiltKeyIntoShards(mnemonic2);

    // This won't throw but will produce garbage - testing the operation completes
    // (In real use, the resulting wallet would be unusable)
    const result = await combineShardsBuildWallet(0, shards1[0]!, shards2[1]!);

    // Result won't match either original mnemonic (demonstrates corruption)
    expect(result.key).not.toBe(mnemonic1);
    expect(result.key).not.toBe(mnemonic2);
  });
});

describe("shard reconstruction without wallet creation", () => {
  // These tests verify the core shard logic independently of wallet mocks
  it("shamirCombine correctly reconstructs from hex shards", async () => {
    const originalMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(originalMnemonic);

    const share1 = hexToBytes(shards[0]!);
    const share2 = hexToBytes(shards[1]!);
    const reconstructed = await shamirCombine([share1, share2]);
    const result = bytesToString(reconstructed);

    expect(result).toBe(originalMnemonic);
  });
});
