# FCB login — tester guide

User signs in with FC Barcelona (email + OTP). UTXOS opens a popup, then returns a non-custodial wallet.

**Staging app:** `https://staging.utxos.dev`  
**Demo origin (local):** `http://localhost:3001`

FCB must be enabled on the project, and the demo origin must be in **Whitelisted URLs**.

---

## 1. SDK — picker (Connect Wallet)

Opens the UTXOS popup. User picks FCB (or Google, etc.).

```ts
import { Web3Wallet } from "@utxos/sdk";

const wallet = await Web3Wallet.enable({
  projectId: "YOUR_PROJECT_ID",
  appUrl: "https://staging.utxos.dev",
  networkId: 0, // preprod
});

const address = await wallet.cardano.getChangeAddress();
const user = wallet.getUser(); // { email, username, provider: "fcb" }
```

In `demo-txsponsor` this is the **Connect Wallet** button (`connectWallet()` with no `directTo`).

---

## 2. SDK — skip picker (`directTo: "fcb"`)

Same `enable()` call. Goes straight to FCB. No provider list.

```ts
const wallet = await Web3Wallet.enable({
  projectId: "YOUR_PROJECT_ID",
  appUrl: "https://staging.utxos.dev",
  networkId: 0,
  directTo: "fcb",
});
```

In `demo-txsponsor` this is the **FCB** button (`connectWallet("fcb")`).

Force a new FCB account (logout first):

```ts
directTo: "fcb",
newSession: true,
```

---

## 3. Auth callback (required)

After FCB OTP, UTXOS redirects to your app `/auth`. Same as `demo-txsponsor/src/pages/auth.tsx`:

```ts
// pages/auth.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";
import { Web3NonCustodialProvider } from "@utxos/sdk";

const provider = new Web3NonCustodialProvider({
  projectId: process.env.NEXT_PUBLIC_UTXOS_PROJECT_ID!,
  appOrigin: typeof window !== "undefined" ? window.location.origin : "",
  googleOauth2ClientId: "",
  twitterOauth2ClientId: "",
  discordOauth2ClientId: "",
});

export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    provider.handleAuthenticationRoute().then((result) => {
      if (result?.error) router.replace("/?error=" + result.error.message);
    });
  }, [router.isReady]);
  return <p>Completing login…</p>;
}
```

---

## What you should see

1. Click **Connect Wallet** or **FCB**.
2. UTXOS popup → FCB hosted login → email OTP.
3. Popup finishes, wallet is connected.
4. `getUser()` has FCB email/name; `getChangeAddress()` returns a Cardano address.

---

## Local demo (`demo-txsponsor`)

```env
NEXT_PUBLIC_ORIGIN=http://localhost:3001
NEXT_PUBLIC_UTXOS_APP_URL=https://staging.utxos.dev
NEXT_PUBLIC_UTXOS_PROJECT_ID=YOUR_PROJECT_ID
```

```bash
npm run dev   # port 3001
```

Whitelist `http://localhost:3001` on that project.

---

## If it fails

| What you see | Check |
|---|---|
| Popup `Refused` | Origin not whitelisted (exact scheme + host + port) |
| `FCB login not enabled` | Enable FCB on the project in UTXOS admin |
| FCB `redirect_uri` error | Staging `FCB_REDIRECT_URI` must be exactly `https://staging.utxos.dev/api/auth` |
| Stuck on FCB after OTP | Use a private window, or `newSession: true` |
