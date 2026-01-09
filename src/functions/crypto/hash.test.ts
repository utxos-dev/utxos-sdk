import { generateHash, hashData } from "./hash";

describe("generateHash", () => {
  it("generates a hex string of default size (64 bytes = 128 hex chars)", async () => {
    const hash = await generateHash({});
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash.length).toBe(128); // 64 bytes = 128 hex characters
  });

  it("generates a hex string of custom size", async () => {
    const hash = await generateHash({ size: 32 });
    expect(hash.length).toBe(64); // 32 bytes = 64 hex characters
  });

  it("generates a hex string of small size", async () => {
    const hash = await generateHash({ size: 8 });
    expect(hash.length).toBe(16); // 8 bytes = 16 hex characters
  });

  it("generates unique hashes on each call", async () => {
    const hash1 = await generateHash({});
    const hash2 = await generateHash({});
    expect(hash1).not.toBe(hash2);
  });
});

describe("hashData", () => {
  it("hashes data with sha256 by default", async () => {
    const hash = await hashData({ data: "hello world" });
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash.length).toBe(64); // SHA-256 = 32 bytes = 64 hex characters
  });

  it("produces consistent hash for same input", async () => {
    const hash1 = await hashData({ data: "test data" });
    const hash2 = await hashData({ data: "test data" });
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different input", async () => {
    const hash1 = await hashData({ data: "data1" });
    const hash2 = await hashData({ data: "data2" });
    expect(hash1).not.toBe(hash2);
  });

  it("hashes data with a private key (HMAC)", async () => {
    const hash = await hashData({
      data: "hello world",
      privateKey: "secret-key",
    });
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);
  });

  it("produces different hash with different private keys", async () => {
    const hash1 = await hashData({ data: "test", privateKey: "key1" });
    const hash2 = await hashData({ data: "test", privateKey: "key2" });
    expect(hash1).not.toBe(hash2);
  });

  it("produces consistent HMAC hash for same input and key", async () => {
    const hash1 = await hashData({ data: "test", privateKey: "secret" });
    const hash2 = await hashData({ data: "test", privateKey: "secret" });
    expect(hash1).toBe(hash2);
  });

  it("hashes data with sha512 algorithm", async () => {
    const hash = await hashData({
      data: "hello world",
      algorithm: "sha512",
    });
    expect(hash.length).toBe(128); // SHA-512 = 64 bytes = 128 hex characters
  });

  it("hashes data with sha1 algorithm", async () => {
    const hash = await hashData({
      data: "hello world",
      algorithm: "sha1",
    });
    expect(hash.length).toBe(40); // SHA-1 = 20 bytes = 40 hex characters
  });

  it("handles empty string input", async () => {
    const hash = await hashData({ data: "" });
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);
  });

  it("handles special characters", async () => {
    const hash = await hashData({ data: "Hello! @#$%^&*() 日本語" });
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);
  });

  it("handles numeric data converted to string", async () => {
    const hash = await hashData({ data: "12345" });
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);
  });
});
