# Google / Discord / X sign-in in React Native (UTXOS)

Requires `@utxos/sdk` ≥ **0.2.9**. Google blocks embedded WebViews, so on React Native the wallet runs in the system browser and returns to the app through a deep link. Browser and popup flows are unchanged.

## 1. Pick a redirect URI
- Use one fixed URI per app, e.g. `myapp://wallet`.
- Prefer an https universal / app link (`https://app.example.com/wallet`) over a custom scheme. Other apps on the device can claim a custom scheme.

## 2. Register it in the app
- **Expo:** add `"scheme": "myapp"` to `app.json`.
- **Bare React Native:** add the iOS URL Type and an Android `intent-filter` for the same scheme or host.

## 3. Whitelist it in the UTXOS dashboard
Project Settings → Security Access → whitelisted URLs. Add the **exact** URI, e.g. `myapp://wallet`.
- The match is exact: no wildcards, no prefixes, no query string or fragment.
- Any other URI is rejected: `http`, `javascript`, `data`, `file`, `intent`, etc.
- An https entry also whitelists that origin for web popups.

## 4. Pass it to the SDK
```ts
const wallet = await Web3Wallet.enable({
  networkId: 1,
  projectId: "<project-id>",
  directTo: "google",              // or "discord" | "twitter"
  redirectUri: "myapp://wallet",   // must match the dashboard entry exactly
});
```
- The same `redirectUri` is reused for later signing requests on `wallet`.
- It is **required** on React Native. The SDK throws if it is missing or invalid.
- Browsers ignore it.

## 5. Recommended dependency
```bash
npm i react-native-inappbrowser-reborn
```
It opens ASWebAuthenticationSession on iOS and Chrome Custom Tabs on Android. Without it the SDK opens the external browser and waits for the deep link, with a 10-minute timeout.

## Behaviour
1. The SDK opens the wallet page in the system browser with `redirect_uri`, `state` and a PKCE challenge.
2. After sign-in, the browser redirects to `myapp://wallet?code=…&state=…`. The result itself is not in the link.
3. The SDK checks `state` and redeems the one-time `code` with its PKCE verifier. The code is valid for 60 seconds and works once.

## Errors
| Symptom | Cause / fix |
|---|---|
| "Sign-in was blocked: `<origin>` is not whitelisted…" | The OAuth return URL's origin isn't in the project whitelist. Add it. |
| "Redirect URI not whitelisted" on the wallet page | `redirectUri` doesn't exactly match the dashboard entry. |
| SDK throws on `redirectUri` | Missing or invalid. Use a custom scheme or https, with no credentials, `%`, `\` or `..`. |
| Browser never returns to the app | The scheme or app link isn't registered in the app. |
| "Unknown project" | Wrong `projectId`. |
| Sign-in cancelled / times out | The user closed the browser, or 10 minutes passed on the fallback path. Retry. |

## Test checklist
- [ ] Google sign-in on a real iOS device
- [ ] Google sign-in on a real Android device
- [ ] A signing request after sign-in, to confirm `redirectUri` is reused
- [ ] The cancel path (close the browser) returns a clean error
- [ ] A non-whitelisted `redirectUri` is rejected with a readable message
- [ ] Wallet state persists after the browser round trip on both platforms. This is unverified for device-shard storage across system-browser sessions.
