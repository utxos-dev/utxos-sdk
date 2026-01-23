import { spiltKeyIntoShards } from "./spilt-key-into-shards";
import { hexToBytes, bytesToString } from "../convertors";
import { shamirCombine } from "./shamir-secret-sharing";

describe("spiltKeyIntoShards", () => {
  it("splits a mnemonic into 3 hex-encoded shards", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    expect(shards.length).toBe(3);
    expect(typeof shards[0]).toBe("string");
    expect(typeof shards[1]).toBe("string");
    expect(typeof shards[2]).toBe("string");
  });

  it("produces hex-encoded shards", async () => {
    const key = "test secret key";
    const shards = await spiltKeyIntoShards(key);

    // Each shard should be valid hex (only 0-9, a-f characters)
    for (const shard of shards) {
      expect(shard).toMatch(/^[0-9a-f]+$/);
    }
  });

  it("produces unique shards", async () => {
    const key = "some secret";
    const shards = await spiltKeyIntoShards(key);

    expect(shards[0]).not.toBe(shards[1]);
    expect(shards[0]).not.toBe(shards[2]);
    expect(shards[1]).not.toBe(shards[2]);
  });

  it("produces shards of consistent length", async () => {
    const key = "test key 12345";
    const shards = await spiltKeyIntoShards(key);

    // All shards should have the same length (key bytes + 1 for x-coordinate, then hex-encoded)
    expect(shards[0]!.length).toBe(shards[1]!.length);
    expect(shards[1]!.length).toBe(shards[2]!.length);
  });

  it("shard length is (key_length + 1) * 2 due to hex encoding", async () => {
    const key = "hello"; // 5 characters = 5 bytes
    const shards = await spiltKeyIntoShards(key);

    // Each shard: 5 bytes + 1 x-coordinate byte = 6 bytes = 12 hex chars
    expect(shards[0]!.length).toBe(12);
  });

  it("handles empty string", async () => {
    // Note: shamirSplit throws on empty secret, but spiltKeyIntoShards converts string to bytes first
    // An empty string becomes an empty Uint8Array, which should throw
    await expect(spiltKeyIntoShards("")).rejects.toThrow("secret cannot be empty");
  });

  it("handles unicode strings", async () => {
    const unicodeKey = "Hello 世界 🎉";
    const shards = await spiltKeyIntoShards(unicodeKey);

    expect(shards.length).toBe(3);
    // Unicode characters take multiple bytes in UTF-8
    expect(shards[0]!.length).toBeGreaterThan(20);
  });

  it("handles long mnemonics", async () => {
    const longMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
    const shards = await spiltKeyIntoShards(longMnemonic);

    expect(shards.length).toBe(3);
  });

  it("produces different shards on each call (due to randomization)", async () => {
    const key = "same key";
    const shards1 = await spiltKeyIntoShards(key);
    const shards2 = await spiltKeyIntoShards(key);

    // At least one shard should differ between calls
    const allSame =
      shards1[0] === shards2[0] &&
      shards1[1] === shards2[1] &&
      shards1[2] === shards2[2];
    expect(allSame).toBe(false);
  });
});

describe("spiltKeyIntoShards 2-of-3 reconstruction", () => {
  it("can reconstruct original key from shards[0] and shards[1]", async () => {
    const originalKey = "my secret mnemonic phrase";
    const shards = await spiltKeyIntoShards(originalKey);

    const share1 = hexToBytes(shards[0]!);
    const share2 = hexToBytes(shards[1]!);
    const reconstructed = await shamirCombine([share1, share2]);
    const result = bytesToString(reconstructed);

    expect(result).toBe(originalKey);
  });

  it("can reconstruct original key from shards[0] and shards[2]", async () => {
    const originalKey = "my secret mnemonic phrase";
    const shards = await spiltKeyIntoShards(originalKey);

    const share1 = hexToBytes(shards[0]!);
    const share3 = hexToBytes(shards[2]!);
    const reconstructed = await shamirCombine([share1, share3]);
    const result = bytesToString(reconstructed);

    expect(result).toBe(originalKey);
  });

  it("can reconstruct original key from shards[1] and shards[2]", async () => {
    const originalKey = "my secret mnemonic phrase";
    const shards = await spiltKeyIntoShards(originalKey);

    const share2 = hexToBytes(shards[1]!);
    const share3 = hexToBytes(shards[2]!);
    const reconstructed = await shamirCombine([share2, share3]);
    const result = bytesToString(reconstructed);

    expect(result).toBe(originalKey);
  });

  it("can reconstruct from all 3 shards", async () => {
    const originalKey = "test key";
    const shards = await spiltKeyIntoShards(originalKey);

    const share1 = hexToBytes(shards[0]!);
    const share2 = hexToBytes(shards[1]!);
    const share3 = hexToBytes(shards[2]!);
    const reconstructed = await shamirCombine([share1, share2, share3]);
    const result = bytesToString(reconstructed);

    expect(result).toBe(originalKey);
  });

  it("preserves 24-word mnemonic through split and combine", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
    const shards = await spiltKeyIntoShards(mnemonic);

    const share1 = hexToBytes(shards[0]!);
    const share2 = hexToBytes(shards[2]!);
    const reconstructed = await shamirCombine([share1, share2]);
    const result = bytesToString(reconstructed);

    expect(result).toBe(mnemonic);
  });

  it("preserves 12-word mnemonic through split and combine", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const shards = await spiltKeyIntoShards(mnemonic);

    const share1 = hexToBytes(shards[1]!);
    const share2 = hexToBytes(shards[2]!);
    const reconstructed = await shamirCombine([share1, share2]);
    const result = bytesToString(reconstructed);

    expect(result).toBe(mnemonic);
  });
});
