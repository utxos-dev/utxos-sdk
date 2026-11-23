import type { LinkingAdapter } from "../../adapters/types";

type UrlHandler = (event: { url: string }) => void;

function loadAdapter(options: { inAppBrowser?: Record<string, jest.Mock> } = {}) {
  const handlers: UrlHandler[] = [];
  const removed: UrlHandler[] = [];
  const Linking = {
    canOpenURL: jest.fn(async () => true),
    openURL: jest.fn(async () => undefined),
    getInitialURL: jest.fn(async () => null),
    addEventListener: jest.fn((_type: string, handler: UrlHandler) => {
      handlers.push(handler);
      return { remove: () => removed.push(handler) };
    }),
  };

  let adapter!: LinkingAdapter;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Linking }), { virtual: true });
    if (options.inAppBrowser) {
      jest.doMock(
        "react-native-inappbrowser-reborn",
        () => ({ default: options.inAppBrowser }),
        { virtual: true },
      );
    } else {
      jest.doMock(
        "react-native-inappbrowser-reborn",
        () => {
          throw new Error("not installed");
        },
        { virtual: true },
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    adapter = require("./linking.native").linkingAdapter;
  });
  return { adapter, Linking, handlers, removed };
}

const REDIRECT = "atlas://wallet";

describe("react-native linking adapter", () => {
  it("declares redirect callback support", () => {
    expect(loadAdapter().adapter.supportsRedirectCallback).toBe(true);
  });

  describe("external browser fallback", () => {
    it("resolves on a callback that matches the redirect URI and state", async () => {
      const { adapter, handlers, removed } = loadAdapter();
      const pending = adapter.openAuthWindow("https://utxos.dev/x", REDIRECT, {
        state: "S1",
      });
      handlers[0]!({ url: "atlas://wallet?code=C&state=S1" });
      await expect(pending).resolves.toEqual({
        code: "C",
        state: "S1",
        error: undefined,
        errorDescription: undefined,
      });
      expect(removed).toHaveLength(1);
    });

    it("ignores unrelated links, foreign targets and wrong state", async () => {
      const { adapter, handlers } = loadAdapter();
      let settled = false;
      const pending = adapter
        .openAuthWindow("https://utxos.dev/x", REDIRECT, { state: "S1" })
        .then((r) => {
          settled = true;
          return r;
        });

      handlers[0]!({ url: "atlas://other?code=evil&state=S1" });
      handlers[0]!({ url: "evil://wallet?code=evil&state=S1" });
      handlers[0]!({ url: "atlas://wallet?code=evil&state=WRONG" });
      handlers[0]!({ url: "atlas://wallet?code=evil" });
      await Promise.resolve();
      expect(settled).toBe(false);

      handlers[0]!({ url: "atlas://wallet?error=access_denied&state=S1" });
      await expect(pending).resolves.toMatchObject({ error: "access_denied" });
    });

    it("times out and removes its listener", async () => {
      jest.useFakeTimers();
      try {
        const { adapter, removed } = loadAdapter();
        const pending = adapter.openAuthWindow("https://utxos.dev/x", REDIRECT, {
          state: "S1",
          timeoutMs: 1000,
        });
        jest.advanceTimersByTime(1001);
        await expect(pending).resolves.toMatchObject({ error: "timeout" });
        expect(removed).toHaveLength(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it("reports a failure to open the browser", async () => {
      const { adapter, Linking, removed } = loadAdapter();
      Linking.openURL.mockRejectedValueOnce(new Error("no browser"));
      await expect(
        adapter.openAuthWindow("https://utxos.dev/x", REDIRECT, { state: "S1" }),
      ).resolves.toMatchObject({ error: "open_failed" });
      expect(removed).toHaveLength(1);
    });
  });

  describe("system auth session (react-native-inappbrowser-reborn)", () => {
    const makeBrowser = (result: unknown) => ({
      isAvailable: jest.fn(async () => true),
      openAuth: jest.fn(async () => result),
    });

    it("returns the verified callback", async () => {
      const inAppBrowser = makeBrowser({
        type: "success",
        url: "atlas://wallet?code=C&state=S1",
      });
      const { adapter, Linking } = loadAdapter({ inAppBrowser });
      const result = await adapter.openAuthWindow("https://utxos.dev/x", REDIRECT, {
        state: "S1",
      });
      expect(result).toMatchObject({ code: "C", state: "S1" });
      expect(inAppBrowser.openAuth).toHaveBeenCalledWith(
        "https://utxos.dev/x",
        REDIRECT,
        expect.objectContaining({ ephemeralWebSession: false }),
      );
      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it("rejects a callback for another target or state", async () => {
      for (const url of [
        "evil://wallet?code=C&state=S1",
        "atlas://wallet?code=C&state=NOPE",
      ]) {
        const { adapter } = loadAdapter({
          inAppBrowser: makeBrowser({ type: "success", url }),
        });
        await expect(
          adapter.openAuthWindow("https://utxos.dev/x", REDIRECT, { state: "S1" }),
        ).resolves.toMatchObject({ error: "invalid_callback" });
      }
    });

    it("maps cancel/dismiss to cancelled", async () => {
      for (const type of ["cancel", "dismiss"]) {
        const { adapter } = loadAdapter({ inAppBrowser: makeBrowser({ type }) });
        await expect(
          adapter.openAuthWindow("https://utxos.dev/x", REDIRECT, { state: "S1" }),
        ).resolves.toMatchObject({ error: "cancelled" });
      }
    });
  });
});
