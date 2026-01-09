import {
  stringToBytes,
  bytesToString,
  bytesToHex,
  hexToBytes,
} from "./convertors";

describe("stringToBytes", () => {
  it("converts ASCII string to bytes", () => {
    const bytes = stringToBytes("hello");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it("converts empty string to empty array", () => {
    const bytes = stringToBytes("");
    expect(bytes.length).toBe(0);
  });

  it("converts unicode string to bytes", () => {
    const bytes = stringToBytes("日本");
    expect(bytes.length).toBeGreaterThan(2); // UTF-8 multibyte
  });

  it("handles special characters", () => {
    const bytes = stringToBytes("!@#$%");
    expect(bytes.length).toBe(5);
  });
});

describe("bytesToString", () => {
  it("converts bytes back to ASCII string", () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    expect(bytesToString(bytes)).toBe("hello");
  });

  it("converts empty array to empty string", () => {
    const bytes = new Uint8Array([]);
    expect(bytesToString(bytes)).toBe("");
  });

  it("roundtrip: string -> bytes -> string", () => {
    const original = "Hello, World! 123";
    const bytes = stringToBytes(original);
    const result = bytesToString(bytes);
    expect(result).toBe(original);
  });

  it("handles unicode roundtrip", () => {
    const original = "日本語テスト";
    const bytes = stringToBytes(original);
    const result = bytesToString(bytes);
    expect(result).toBe(original);
  });
});

describe("bytesToHex", () => {
  it("converts bytes to hex string", () => {
    const bytes = new Uint8Array([0, 15, 16, 255]);
    expect(bytesToHex(bytes)).toBe("000f10ff");
  });

  it("converts empty array to empty string", () => {
    const bytes = new Uint8Array([]);
    expect(bytesToHex(bytes)).toBe("");
  });

  it("pads single digit hex values", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bytesToHex(bytes)).toBe("00010203040506070809");
  });

  it("handles large values correctly", () => {
    const bytes = new Uint8Array([255, 254, 253]);
    expect(bytesToHex(bytes)).toBe("fffefd");
  });

  it("produces lowercase hex", () => {
    const bytes = new Uint8Array([171, 205, 239]);
    expect(bytesToHex(bytes)).toBe("abcdef");
    expect(bytesToHex(bytes)).not.toMatch(/[A-F]/);
  });
});

describe("hexToBytes", () => {
  it("converts hex string to bytes", () => {
    const bytes = hexToBytes("000f10ff");
    expect(Array.from(bytes)).toEqual([0, 15, 16, 255]);
  });

  it("converts empty string to empty array", () => {
    const bytes = hexToBytes("");
    expect(bytes.length).toBe(0);
  });

  it("handles lowercase hex", () => {
    const bytes = hexToBytes("abcdef");
    expect(Array.from(bytes)).toEqual([171, 205, 239]);
  });

  it("handles uppercase hex", () => {
    const bytes = hexToBytes("ABCDEF");
    expect(Array.from(bytes)).toEqual([171, 205, 239]);
  });

  it("handles mixed case hex", () => {
    const bytes = hexToBytes("AbCdEf");
    expect(Array.from(bytes)).toEqual([171, 205, 239]);
  });

  it("roundtrip: bytes -> hex -> bytes", () => {
    const original = new Uint8Array([0, 127, 128, 255, 1, 2, 3]);
    const hex = bytesToHex(original);
    const result = hexToBytes(hex);
    expect(Array.from(result)).toEqual(Array.from(original));
  });
});

describe("full roundtrip: string -> bytes -> hex -> bytes -> string", () => {
  it("preserves ASCII string through full conversion cycle", () => {
    const original = "hello world";
    const bytes1 = stringToBytes(original);
    const hex = bytesToHex(bytes1);
    const bytes2 = hexToBytes(hex);
    const result = bytesToString(bytes2);
    expect(result).toBe(original);
  });

  it("preserves unicode string through full conversion cycle", () => {
    const original = "こんにちは";
    const bytes1 = stringToBytes(original);
    const hex = bytesToHex(bytes1);
    const bytes2 = hexToBytes(hex);
    const result = bytesToString(bytes2);
    expect(result).toBe(original);
  });

  it("handles large data", () => {
    const original = "x".repeat(10000);
    const bytes1 = stringToBytes(original);
    const hex = bytesToHex(bytes1);
    const bytes2 = hexToBytes(hex);
    const result = bytesToString(bytes2);
    expect(result).toBe(original);
  });
});
