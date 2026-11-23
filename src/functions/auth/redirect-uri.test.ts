import {
  buildRedirectUrl,
  isRedirectUriWhitelisted,
  normalizeRedirectUri,
  parseRedirectCallback,
} from "./redirect-uri";
import { isSafeAuthRedirect } from "./safe-auth-redirect";

describe("normalizeRedirectUri", () => {
  it.each([
    ["atlas://wallet", "atlas://wallet"],
    ["atlas://wallet/", "atlas://wallet"],
    ["ATLAS://wallet", "atlas://wallet"],
    ["atlas://", "atlas://"],
    ["com.example.app://oauth/callback", "com.example.app://oauth/callback"],
    ["https://App.Example.com/cb", "https://app.example.com/cb"],
    ["https://app.example.com:8443/cb/", "https://app.example.com:8443/cb"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeRedirectUri(input)).toBe(expected);
  });

  it.each([
    "",
    "atlas",
    "atlas:wallet",
    "javascript://%0aalert(1)",
    "javascript:alert(1)",
    "data://text/html,hi",
    "file:///etc/passwd",
    "http://app.example.com/cb",
    "http://localhost:3000",
    "intent://scan/#Intent;scheme=zxing;end",
    "tel://123",
    "https://",
    "https:///cb",
    "https://user:pass@app.example.com/cb",
    "atlas://user@wallet",
    "atlas://wallet?x=1",
    "atlas://wallet#frag",
    "atlas://wallet/../admin",
    "atlas://wallet/./x",
    "atlas://wallet//x",
    "atlas://wal%6cet",
    "atlas://wallet/%2e%2e/x",
    "atlas://wallet\\x",
    "atlas://wal let",
    "atlas://wallet\n",
    "atlas://wället",
    `atlas://${"a".repeat(2100)}`,
  ])("rejects %j", (input) => {
    expect(normalizeRedirectUri(input)).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(normalizeRedirectUri(undefined as unknown as string)).toBeNull();
    expect(normalizeRedirectUri(null as unknown as string)).toBeNull();
    expect(normalizeRedirectUri(42 as unknown as string)).toBeNull();
  });
});

describe("isRedirectUriWhitelisted", () => {
  const whitelist = [
    "http://localhost:3000",
    "https://example.com",
    "atlas://wallet",
    "https://app.example.com/cb",
  ];

  it("matches exactly, ignoring case of scheme/host and trailing slash", () => {
    expect(isRedirectUriWhitelisted("atlas://wallet", whitelist)).toBe(true);
    expect(isRedirectUriWhitelisted("ATLAS://wallet/", whitelist)).toBe(true);
    expect(isRedirectUriWhitelisted("https://APP.example.com/cb", whitelist)).toBe(
      true,
    );
  });

  it("does not match prefixes, siblings or other paths", () => {
    expect(isRedirectUriWhitelisted("atlas://wallet/evil", whitelist)).toBe(false);
    expect(isRedirectUriWhitelisted("atlas://wallet2", whitelist)).toBe(false);
    expect(isRedirectUriWhitelisted("atlas://", whitelist)).toBe(false);
    expect(isRedirectUriWhitelisted("evil://wallet", whitelist)).toBe(false);
    expect(isRedirectUriWhitelisted("https://app.example.com/other", whitelist)).toBe(
      false,
    );
    expect(isRedirectUriWhitelisted("https://evil.example.com/cb", whitelist)).toBe(
      false,
    );
  });

  it("does not let a bare web origin whitelist a deep path", () => {
    expect(isRedirectUriWhitelisted("https://example.com/anything", whitelist)).toBe(
      false,
    );
  });

  it("is case-sensitive for custom scheme hosts and paths", () => {
    expect(isRedirectUriWhitelisted("atlas://Wallet", whitelist)).toBe(false);
  });

  it("never matches wildcards or invalid input", () => {
    expect(isRedirectUriWhitelisted("atlas://wallet", ["*"])).toBe(false);
    expect(isRedirectUriWhitelisted("javascript:alert(1)", ["*"])).toBe(false);
    expect(isRedirectUriWhitelisted("atlas://wallet", [])).toBe(false);
    expect(isRedirectUriWhitelisted("atlas://wallet", undefined)).toBe(false);
    expect(isRedirectUriWhitelisted("atlas://wallet", null)).toBe(false);
  });
});

describe("parseRedirectCallback", () => {
  it("returns the query parameters of an exact match", () => {
    expect(
      parseRedirectCallback("atlas://wallet?code=abc&state=x%20y", "atlas://wallet"),
    ).toEqual({ code: "abc", state: "x y" });
  });

  it("tolerates a trailing slash", () => {
    expect(parseRedirectCallback("atlas://wallet/?code=1", "atlas://wallet")).toEqual({
      code: "1",
    });
  });

  it("rejects a different target", () => {
    expect(parseRedirectCallback("atlas://other?code=1", "atlas://wallet")).toBeNull();
    expect(parseRedirectCallback("evil://wallet?code=1", "atlas://wallet")).toBeNull();
    expect(
      parseRedirectCallback("atlas://wallet/extra?code=1", "atlas://wallet"),
    ).toBeNull();
  });

  it("ignores fragment parameters", () => {
    expect(
      parseRedirectCallback("atlas://wallet?code=1#code=2", "atlas://wallet"),
    ).toEqual({ code: "1" });
  });

  it("keeps the first occurrence of duplicated parameters", () => {
    expect(
      parseRedirectCallback("atlas://wallet?code=1&code=2", "atlas://wallet"),
    ).toEqual({ code: "1" });
  });

  it("rejects malformed encodings and invalid expectations", () => {
    expect(parseRedirectCallback("atlas://wallet?code=%E0%A4%A", "atlas://wallet")).toBeNull();
    expect(parseRedirectCallback("atlas://wallet?code=1", "javascript:1")).toBeNull();
  });
});

describe("buildRedirectUrl", () => {
  it("appends encoded parameters and skips empty ones", () => {
    expect(
      buildRedirectUrl("atlas://wallet/", { code: "a b", state: "s", none: undefined }),
    ).toBe("atlas://wallet?code=a%20b&state=s");
  });

  it("refuses unsafe redirect URIs", () => {
    expect(buildRedirectUrl("javascript:alert(1)", { code: "1" })).toBeNull();
  });
});

describe("isSafeAuthRedirect", () => {
  it.each([
    "/dashboard",
    "/client/wallet?projectId=1",
    "https://utxos.dev/client/wallet?x=1",
    "http://localhost:3000/auth",
  ])("allows %s", (value) => {
    expect(isSafeAuthRedirect(value)).toBe(true);
  });

  it.each([
    "",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "atlas://wallet",
    "https://",
  ])("blocks %j", (value) => {
    expect(isSafeAuthRedirect(value)).toBe(false);
  });
});
