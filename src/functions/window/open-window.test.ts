import { createHash } from "crypto";
import { setAdapters } from "../../internal/platform-context";
import { browserAdapters } from "../../platforms/browser";
import type {
  AuthCallbackResult,
  LinkingAdapter,
  PlatformAdapters,
} from "../../adapters/types";
import { openWindow } from "./open-window";

type OpenAuthMock = jest.Mock<Promise<AuthCallbackResult>, any[]>;

function installLinking(
  overrides: Partial<LinkingAdapter> & { openAuthWindow: OpenAuthMock },
) {
  const adapters: PlatformAdapters = {
    ...browserAdapters,
    linking: { ...browserAdapters.linking, ...overrides },
  };
  setAdapters(adapters);
}

// `setAdapters` only allows re-initialisation in development mode.
const originalNodeEnv = process.env.NODE_ENV;
beforeAll(() => {
  process.env.NODE_ENV = "development";
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  jest.restoreAllMocks();
});

const params = {
  method: "enable",
  projectId: "project-1",
  directTo: "google",
  refreshToken: "undefined",
  keepWindowOpen: "false",
  networkId: "1",
} as const;

function base64Url(buf: Buffer) {
  return buf.toString("base64url");
}

describe("openWindow (redirect based platforms)", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setAdapters(browserAdapters);
  });

  function nativeLinking(callback: (url: URL, state: string) => AuthCallbackResult) {
    const openAuthWindow: OpenAuthMock = jest.fn(async (url: string) => {
      const parsed = new URL(url);
      return callback(parsed, parsed.searchParams.get("state") ?? "");
    });
    installLinking({ supportsRedirectCallback: true, openAuthWindow });
    return openAuthWindow;
  }

  it("requires a redirectUri", async () => {
    nativeLinking(() => ({}));
    await expect(openWindow(params)).rejects.toThrow(/redirectUri/);
  });

  it("rejects unsafe redirect URIs before opening anything", async () => {
    const open = nativeLinking(() => ({}));
    await expect(
      openWindow(params, "https://utxos.dev/", { redirectUri: "javascript:alert(1)" }),
    ).rejects.toThrow(/valid app link/);
    expect(open).not.toHaveBeenCalled();
  });

  it("sends redirect_uri, state and a matching S256 code_challenge", async () => {
    let seen!: URL;
    let verifier = "";
    const open = nativeLinking((url, state) => {
      seen = url;
      return { code: "the-code", state };
    });
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      verifier = JSON.parse(init.body).codeVerifier;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { method: "enable" } }),
      };
    });

    const result = await openWindow(params, "https://utxos.dev/", {
      redirectUri: "atlas://wallet/",
    });

    expect(result).toEqual({ success: true, data: { method: "enable" } });
    expect(open).toHaveBeenCalledTimes(1);
    expect(seen.searchParams.get("redirect_uri")).toBe("atlas://wallet");
    expect(seen.searchParams.get("code_challenge_method")).toBe("S256");
    expect(seen.searchParams.get("projectId")).toBe("project-1");
    // verifier is never sent to the browser
    expect(seen.toString()).not.toContain(verifier);
    const expectedChallenge = base64Url(createHash("sha256").update(verifier).digest());
    expect(seen.searchParams.get("code_challenge")).toBe(expectedChallenge);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(open.mock.calls[0]![1]).toBe("atlas://wallet");
    expect(open.mock.calls[0]![2]).toEqual({ state: seen.searchParams.get("state") });

    const [exchangeUrl, init] = fetchMock.mock.calls[0]!;
    expect(exchangeUrl).toBe("https://utxos.dev/api/native-handoff/exchange");
    expect(JSON.parse(init.body)).toEqual({
      projectId: "project-1",
      code: "the-code",
      codeVerifier: verifier,
    });
  });

  it("never redeems a code when the returned state does not match", async () => {
    nativeLinking(() => ({ code: "stolen", state: "attacker-state" }));
    const result = await openWindow(params, "https://utxos.dev/", {
      redirectUri: "atlas://wallet",
    });
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never redeems a code when state is missing", async () => {
    nativeLinking(() => ({ code: "stolen" }));
    const result = await openWindow(params, "https://utxos.dev/", {
      redirectUri: "atlas://wallet",
    });
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps cancellation and wallet errors without calling the backend", async () => {
    nativeLinking(() => ({ error: "cancelled" }));
    await expect(
      openWindow(params, "https://utxos.dev/", { redirectUri: "atlas://wallet" }),
    ).resolves.toEqual({ success: false, message: "Window was closed by the user" });

    nativeLinking(() => ({ error: "access_denied", errorDescription: "x".repeat(500) }));
    const denied = await openWindow(params, "https://utxos.dev/", {
      redirectUri: "atlas://wallet",
    });
    expect(denied.success).toBe(false);
    expect(denied.message.length).toBeLessThanOrEqual(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the exchange is rejected or the network fails", async () => {
    nativeLinking((_u, state) => ({ code: "c", state }));

    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });
    const rejected = await openWindow(params, "https://utxos.dev/", {
      redirectUri: "atlas://wallet",
    });
    expect(rejected.success).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const offline = await openWindow(params, "https://utxos.dev/", {
      redirectUri: "atlas://wallet",
    });
    expect(offline.success).toBe(false);

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => "nope" });
    const garbage = await openWindow(params, "https://utxos.dev/", {
      redirectUri: "atlas://wallet",
    });
    expect(garbage.success).toBe(false);
  });
});

describe("openWindow (popup platforms)", () => {
  afterEach(() => setAdapters(browserAdapters));

  it("ignores redirectUri and returns the postMessage payload", async () => {
    const openAuthWindow: OpenAuthMock = jest.fn(async () => ({
      data: { success: true, data: { method: "disable" } },
    }));
    installLinking({ supportsRedirectCallback: false, openAuthWindow });

    const result = await openWindow(
      { method: "disable", projectId: "p" },
      "https://utxos.dev/",
      { redirectUri: "atlas://wallet" },
    );

    expect(result).toEqual({ success: true, data: { method: "disable" } });
    const url = new URL(openAuthWindow.mock.calls[0]![0]);
    expect(url.searchParams.has("redirect_uri")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });
});
