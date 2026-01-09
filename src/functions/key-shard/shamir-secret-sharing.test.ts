import { shamirSplit, shamirCombine } from "./shamir-secret-sharing";

describe("shamirSplit", () => {
  it("splits a secret into the requested number of shares", async () => {
    const secret = new Uint8Array([1, 2, 3, 4, 5]);
    const shares = await shamirSplit(secret, 3, 2);
    expect(shares.length).toBe(3);
  });

  it("each share has length = secret.length + 1", async () => {
    const secret = new Uint8Array([1, 2, 3, 4, 5]);
    const shares = await shamirSplit(secret, 3, 2);
    for (const share of shares) {
      expect(share.length).toBe(6); // 5 + 1 for x-coordinate
    }
  });

  it("produces different shares for same secret (randomized)", async () => {
    const secret = new Uint8Array([1, 2, 3, 4, 5]);
    const shares1 = await shamirSplit(secret, 3, 2);
    const shares2 = await shamirSplit(secret, 3, 2);
    // At least one share should be different (extremely unlikely to be same)
    const allSame = shares1.every((s1, i) => {
      const s2 = shares2[i]!;
      return s1.every((b, j) => b === s2[j]);
    });
    expect(allSame).toBe(false);
  });

  it("works with different threshold values", async () => {
    const secret = new Uint8Array([10, 20, 30]);
    const shares = await shamirSplit(secret, 5, 3);
    expect(shares.length).toBe(5);
  });

  it("throws if secret is empty", async () => {
    const secret = new Uint8Array([]);
    await expect(shamirSplit(secret, 3, 2)).rejects.toThrow(
      "secret cannot be empty",
    );
  });

  it("throws if shares < 2", async () => {
    const secret = new Uint8Array([1, 2, 3]);
    await expect(shamirSplit(secret, 1, 1)).rejects.toThrow(
      "shares must be at least 2 and at most 255",
    );
  });

  it("throws if shares > 255", async () => {
    const secret = new Uint8Array([1, 2, 3]);
    await expect(shamirSplit(secret, 256, 2)).rejects.toThrow(
      "shares must be at least 2 and at most 255",
    );
  });

  it("throws if threshold < 2", async () => {
    const secret = new Uint8Array([1, 2, 3]);
    await expect(shamirSplit(secret, 3, 1)).rejects.toThrow(
      "threshold must be at least 2 and at most 255",
    );
  });

  it("throws if threshold > 255", async () => {
    const secret = new Uint8Array([1, 2, 3]);
    await expect(shamirSplit(secret, 3, 256)).rejects.toThrow(
      "threshold must be at least 2 and at most 255",
    );
  });

  it("throws if shares < threshold", async () => {
    const secret = new Uint8Array([1, 2, 3]);
    await expect(shamirSplit(secret, 2, 3)).rejects.toThrow(
      "shares cannot be less than threshold",
    );
  });

  it("throws if secret is not Uint8Array", async () => {
    await expect(
      shamirSplit([1, 2, 3] as unknown as Uint8Array, 3, 2),
    ).rejects.toThrow("secret must be a Uint8Array");
  });
});

describe("shamirCombine", () => {
  it("reconstructs secret from threshold number of shares", async () => {
    const secret = new Uint8Array([1, 2, 3, 4, 5]);
    const shares = await shamirSplit(secret, 3, 2);
    const reconstructed = await shamirCombine([shares[0]!, shares[1]!]);
    expect(Array.from(reconstructed)).toEqual(Array.from(secret));
  });

  it("reconstructs secret from any 2 shares in 2-of-3 scheme", async () => {
    const secret = new Uint8Array([10, 20, 30, 40, 50]);
    const shares = await shamirSplit(secret, 3, 2);

    // Try all combinations of 2 shares
    const combo1 = await shamirCombine([shares[0]!, shares[1]!]);
    const combo2 = await shamirCombine([shares[0]!, shares[2]!]);
    const combo3 = await shamirCombine([shares[1]!, shares[2]!]);

    expect(Array.from(combo1)).toEqual(Array.from(secret));
    expect(Array.from(combo2)).toEqual(Array.from(secret));
    expect(Array.from(combo3)).toEqual(Array.from(secret));
  });

  it("reconstructs secret from all 3 shares", async () => {
    const secret = new Uint8Array([1, 2, 3]);
    const shares = await shamirSplit(secret, 3, 2);
    const reconstructed = await shamirCombine(shares);
    expect(Array.from(reconstructed)).toEqual(Array.from(secret));
  });

  it("reconstructs secret in 3-of-5 scheme", async () => {
    const secret = new Uint8Array([11, 22, 33, 44]);
    const shares = await shamirSplit(secret, 5, 3);

    // Need at least 3 shares
    const reconstructed = await shamirCombine([
      shares[0]!,
      shares[2]!,
      shares[4]!,
    ]);
    expect(Array.from(reconstructed)).toEqual(Array.from(secret));
  });

  it("handles single-byte secret", async () => {
    const secret = new Uint8Array([42]);
    const shares = await shamirSplit(secret, 3, 2);
    const reconstructed = await shamirCombine([shares[0]!, shares[1]!]);
    expect(Array.from(reconstructed)).toEqual([42]);
  });

  it("handles large secret", async () => {
    const secret = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      secret[i] = i;
    }
    const shares = await shamirSplit(secret, 3, 2);
    const reconstructed = await shamirCombine([shares[0]!, shares[2]!]);
    expect(Array.from(reconstructed)).toEqual(Array.from(secret));
  });

  it("throws if shares array is empty", async () => {
    await expect(shamirCombine([])).rejects.toThrow(
      "shares must have at least 2 and at most 255 elements",
    );
  });

  it("throws if only 1 share provided", async () => {
    const secret = new Uint8Array([1, 2, 3]);
    const shares = await shamirSplit(secret, 3, 2);
    await expect(shamirCombine([shares[0]!])).rejects.toThrow(
      "shares must have at least 2 and at most 255 elements",
    );
  });

  it("throws if shares have different lengths", async () => {
    const share1 = new Uint8Array([1, 2, 3, 10]);
    const share2 = new Uint8Array([4, 5, 20]);
    await expect(shamirCombine([share1, share2])).rejects.toThrow(
      "all shares must have the same byte length",
    );
  });

  it("throws if share is too short (< 2 bytes)", async () => {
    const share1 = new Uint8Array([1]);
    const share2 = new Uint8Array([2]);
    await expect(shamirCombine([share1, share2])).rejects.toThrow(
      "each share must be at least 2 bytes",
    );
  });

  it("throws if duplicate x-coordinates", async () => {
    // Create two shares with same x-coordinate (last byte)
    const share1 = new Uint8Array([1, 2, 3, 10]);
    const share2 = new Uint8Array([4, 5, 6, 10]); // Same x-coordinate
    await expect(shamirCombine([share1, share2])).rejects.toThrow(
      "shares must contain unique values but a duplicate was found",
    );
  });

  it("throws if shares is not an Array", async () => {
    await expect(
      shamirCombine("not an array" as unknown as Uint8Array[]),
    ).rejects.toThrow("shares must be an Array");
  });

  it("throws if share is not Uint8Array", async () => {
    await expect(
      shamirCombine([[1, 2, 3, 10], [4, 5, 6, 20]] as unknown as Uint8Array[]),
    ).rejects.toThrow("each share must be a Uint8Array");
  });
});

describe("shamirSplit and shamirCombine roundtrip", () => {
  it("preserves secret through split and combine", async () => {
    const originalSecret = new TextEncoder().encode("hello world secret");
    const shares = await shamirSplit(originalSecret, 5, 3);
    const reconstructed = await shamirCombine([
      shares[1]!,
      shares[3]!,
      shares[4]!,
    ]);
    const decoded = new TextDecoder().decode(reconstructed);
    expect(decoded).toBe("hello world secret");
  });

  it("preserves mnemonic through split and combine", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const secret = new TextEncoder().encode(mnemonic);
    const shares = await shamirSplit(secret, 3, 2);
    const reconstructed = await shamirCombine([shares[0]!, shares[2]!]);
    const decoded = new TextDecoder().decode(reconstructed);
    expect(decoded).toBe(mnemonic);
  });

  it("handles unicode content", async () => {
    const unicodeSecret = new TextEncoder().encode("Hello 世界 🎉 привет");
    const shares = await shamirSplit(unicodeSecret, 3, 2);
    const reconstructed = await shamirCombine([shares[1]!, shares[2]!]);
    const decoded = new TextDecoder().decode(reconstructed);
    expect(decoded).toBe("Hello 世界 🎉 привет");
  });
});
