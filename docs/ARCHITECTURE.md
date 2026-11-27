# UTXOS v2: Identity, Wallet and Platform Architecture

Status: **draft for review**. Nothing here is implemented yet. Everything in "Current state" was read from the code in `utxos-sdk` and `utxos-dev`.

**Goal:** one backend, one protocol, thin platform adapters. A developer integrates UTXOS in any environment (web, React, React Native, Capacitor, later Flutter, iOS, Android) without rebuilding identity or wallet infrastructure. Existing integrations keep working unchanged.

---

## 1. Architectural rules

1. **Identity owns Wallet.** A wallet cannot exist without an identity.
2. **Identity is independent.** An identity can exist with zero wallets.
3. **Wallet lifecycle is independent.** Suspending or deleting a wallet never deletes or suspends its identity.
4. **Authentication is separate from signing.** An identity session never authorises a signature. Every signature needs its own approval bound to chain, network and payload.

Consequences enforced in the backend:

| Rule | Enforcement |
|---|---|
| 1 | `wallet.identityId` is `NOT NULL` with a foreign key to the identity. Wallet endpoints require an identity session. |
| 2 | Sign-in creates an identity only. No wallet or key material is created. |
| 3 | Wallets have a `status` (`active`, `suspended`, `deleted`). Wallet rows never cascade into identity rows. |
| 4 | Identity tokens carry the scope `identity`. Signing needs a separate single-use **signing grant**. See section 5. |

---

## 2. Current state

| Area | Today |
|---|---|
| Identity | `Web3NonCustodialProvider` (`src/non-custodial`): Google, Discord, X, email OTP, FCB. Stores a JWT. Identity is the `User` row. |
| Wallet creation | `createWallet` calls `clientGenerateWallet`, which derives **every** chain at once: Cardano, Bitcoin mainnet and testnet, Spark mainnet and regtest. One `wallets` row holds all public key hashes and addresses. |
| Wallet use | `Web3Wallet.enable({ networkId, directTo })` opens the wallet page (popup, or system browser on React Native). Chains are initialised by `initCardanoWallet`, `initBitcoinWallet`, `initSparkWallet`. |
| Signing | Done in the wallet page context. Session and signing approval are not separated at the API level. |
| Backend API | Flat `/api/wallet`, `/api/auth/*`, `/api/device`, `/api/user/devices`, `/api/project-wallet*`, `/api/spark/*`, plus the new `/api/native-handoff/*`. |
| Platforms | Browser build (popup) and React Native build (system browser + PKCE hand-off). Capacitor is not supported: the WebView would open an embedded WebView, which Google blocks. |

Problems this design fixes:

- Sign-in and wallet creation are coupled, and creating a wallet derives all chains. That is the main load on sign-in.
- One `wallets` row mixes chains and networks. A chain cannot be added without a schema change.
- Platform logic is mixed into the core.

---

## 3. Target layers

```
5. Chain adapters     cardano | bitcoin | spark | (future)
4. Native bridges     system browser auth, deep/app links, secure storage, device crypto
3. Platform SDKs      web | react | react-native | capacitor | (flutter, ios, android)
2. Universal protocol HTTPS API, OAuth 2.0 / OIDC with PKCE, wallet request protocol
1. UTXOS Core API     identity, authentication, wallets, permissions, sessions, signing grants
```

Platform differences stay in layer 4. Layers 1 and 2 do not change per platform.

### Packages

| Package | Contents | Notes |
|---|---|---|
| `@utxos/sdk` (existing) | Legacy API, unchanged | Only receives fixes. Later re-exports v2 pieces. |
| `@utxos-sdk/core` | `UtxosIdentity`, `UtxosWallet`, protocol, adapter interfaces | No platform code. |
| `@utxos-sdk/chain-cardano`, `-bitcoin`, `-spark` | Chain adapters | Lazy loaded. See section 7. |
| `@utxos-sdk/web` | Popup auth bridge | |
| `@utxos-sdk/react` | Hooks and provider on top of web | |
| `@utxos-sdk/react-native` | System browser bridge (today's `linking.native`) | |
| `@utxos-sdk/capacitor` | `@capacitor/browser` + `@capacitor/app` bridge | **First new platform.** |
| Later: flutter, ios, android | Same bridge contract | |

Open decision: the published scope is `@utxos/sdk` today. `@utxos-sdk/*` needs a new npm scope. Confirm it, or use `@utxos/*`.

---

## 4. Public API

Two new classes. The legacy `Web3Wallet` and `Web3NonCustodialProvider` stay as they are.

### 4.1 `UtxosIdentity`: sign-in only

```ts
const identity = new UtxosIdentity({ projectId, platform });   // platform = a bridge from layer 4

const session = await identity.signIn({ provider: "google" }); // "google" | "discord" | "twitter" | "email" | "fcb"
identity.getSession();   // { identityId, provider, expiresAt, ... } | null
identity.onChange(cb);   // session started / refreshed / ended
await identity.signOut();
```

- `signIn` takes a **provider option**. The platform bridge decides how to run it: popup, system browser, or email OTP (no browser).
- An identity session carries scope `identity` only. It cannot sign.
- Environments supported for sign-in: React (web), React Native, and Capacitor. Others later through bridges.

### 4.2 `UtxosWallet`: chain specific

A wallet requires an identity session. Wallets are created and connected **per chain and network**, never all at once.

```ts
const wallet = new UtxosWallet({ identity });

// Pre-bound chain handles
wallet.chain.cardano            // mainnet
wallet.chain.cardano.testnet
wallet.chain.bitcoin            // mainnet
wallet.chain.bitcoin.testnet
wallet.chain.spark              // mainnet
wallet.chain.spark.regtest

// Every handle, and wallet itself, exposes the same five operations
await wallet.connect({ chain: "cardano", network: "mainnet", create: "if-missing" });
await wallet.chain.cardano.signMessage({ message });
await wallet.chain.cardano.signTransaction({ tx });
await wallet.chain.cardano.submitTransaction({ signedTx });
await wallet.disconnect({ chain: "cardano", network: "mainnet" });
```

| Operation | Meaning |
|---|---|
| `connect` | Find the wallet for (identity, chain, network). With `create: "if-missing"` create only that one. With `create: "never"` fail if it does not exist. |
| `signMessage` | Sign a message. Needs a signing grant. |
| `signTransaction` | Validate with the chain adapter, then sign. Needs a signing grant. |
| `submitTransaction` | Submit a transaction that was signed and approved. Does not sign. |
| `disconnect` | End the connection on this device. Does not delete the wallet or the identity. |

`wallet.connect(target)` is shorthand for `wallet.chain.<chain>[.<network>].connect()`. Adding a chain means adding an adapter, not changing the core.

### 4.3 Chain adapters

Each adapter implements its own parsing, validation and signing. Signing is never generic.

```ts
interface ChainAdapter<Tx, SignedTx> {
  chain: "cardano" | "bitcoin" | "spark";
  networks: readonly string[];
  deriveWallet(secret, network): PublicWalletInfo;  // derives only this chain and network
  validateTransaction(tx: Tx, ctx): ValidationResult; // network match, outputs, fees, policy
  signMessage(...): Promise<Signature>;
  signTransaction(tx: Tx, grant: SigningGrant): Promise<SignedTx>;
  submitTransaction(signed: SignedTx): Promise<{ txId: string }>;
}
```

Adapter notes:

- **Cardano:** CIP-30/CIP-8 style message signing, witness set signing, stake credential handling.
- **Bitcoin:** PSBT validation (`psbt-validation` already exists in the app), per-network address rules.
- **Spark:** Spark transfer signing and static deposit address handling.

---

## 5. Signing is separate from authentication

1. The app calls `signTransaction`. The adapter validates the transaction locally.
2. The SDK asks the wallet service for a signing grant: `chain`, `network`, `walletId` and a hash of the payload.
3. The user approves in the wallet context (popup, system browser, or native bridge). Approval uses the same PKCE hand-off as today's native flow.
4. The grant is **single use, short lived (60s) and bound to the payload hash.** A different payload cannot reuse it.
5. Key shards are assembled in the wallet context, the adapter signs, and the signature is returned.

Keys never reach the host app. Submission is a separate step.

---

## 6. Backend API (versioned, additive)

New routes live under `/api/v2`. Existing routes are not touched, so old SDK versions keep working. Three groups:

### Identity (`/api/v2/identity`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | Start a session. Provider callback and PKCE exchange. |
| POST | `/sessions/refresh` | Refresh. |
| DELETE | `/sessions/current` | Sign out. |
| GET | `/me` | Identity profile. |
| POST | `/email/otp`, `/email/verify` | Email provider. |
| POST | `/native-handoff/exchange` | Today's `/api/native-handoff/*`, folded in. |

### Wallet (`/api/v2/wallet`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/?chain=&network=` | List the identity's wallets, optionally filtered. |
| POST | `/` | Create **one** wallet: body has `chain`, `network` and that chain's public info only. |
| GET | `/{walletId}` | Read one wallet. |
| POST | `/{walletId}/sign-requests` | Request a signing grant (rule 4). |
| POST | `/{walletId}/suspend`, `/restore` | Lifecycle (rule 3). |
| DELETE | `/{walletId}` | Soft delete. The identity stays. |
| POST | `/{walletId}/devices` | Register a device. |

### Project wallet (`/api/v2/project-wallet`)

Developer-controlled wallets, authenticated with the project API key, not an identity session.

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/{projectId}` | List and create, chain and network specific. |
| GET | `/{projectId}/{walletId}` | Read one. |
| GET/POST | `/{projectId}/{walletId}/tags` | Tags. |
| POST | `/{projectId}/{walletId}/sign-requests` | Server-side signing grant. |

### Data model (additive)

```
Wallet (existing)  ->  kept as the "legacy multi-chain wallet", read through the new adapters.

ChainWallet (new)
  id, identityId (NOT NULL, FK User, onDelete: Restrict)
  projectId, chain, network
  publicKeyHash, address
  status: active | suspended | deleted
  legacyWalletId?  (links to the existing row when migrated lazily)
  createdAt, updatedAt
  unique(identityId, projectId, chain, network)

SigningGrant (new)
  id, walletId, payloadHash, chain, network, expiresAt, usedAt
```

Existing users are not migrated up front. On first v2 `connect`, a legacy `wallets` row is exposed as a `ChainWallet` for the requested chain and linked through `legacyWalletId`. Open decision below.

---

## 7. Load reduction

- **Sign-in creates nothing but the identity.** No key derivation, no wallet request.
- **Derive only what was asked for.** `deriveWallet(secret, network)` runs for one chain and network. The legacy path derives five.
- **Chain adapters load on demand** (dynamic `import()` per chain package). A Cardano app never loads Bitcoin or Spark code.
- **Subpath/package split.** Identity-only apps do not pull wallet or crypto code.
- **Wallet UI loads only for signing**, not for sign-in.

---

## 8. Platform bridge contract

Every platform SDK implements the same small interface. Core code never imports platform code.

```ts
interface PlatformBridge {
  openAuthSession(url: string, redirectUri: string, opts: { state: string }): Promise<AuthCallback>;
  secureStorage: { get(k): Promise<string | null>; set(k, v): Promise<void>; remove(k): Promise<void> };
  crypto: { getRandomBytes(n): Uint8Array; subtle: SubtleCrypto };
  userAgent(): string;
}
```

The protocol on top is fixed: OAuth 2.0 / OIDC with PKCE (S256), `state`, exact redirect URI matching against the project whitelist, one-time hand-off code. This already exists in the current native flow and is reused as is.

### Capacitor bridge (first)

- Uses `@capacitor/browser` (SFSafariViewController, Chrome Custom Tabs) and `@capacitor/app` (`appUrlOpen`).
- Plain browsers and PWAs keep using the web bridge. The bridge is chosen by the package the developer installs, not by runtime sniffing in the core.
- Use a custom scheme redirect (`myapp://wallet`). `SFSafariViewController` does not reliably return https universal links to the app. Needs device testing.
- Treat the browser-closed event on Android as a cancel only after a short grace period, because it can fire before the deep link.
- Known gap: no `ASWebAuthenticationSession` through `@capacitor/browser`. iOS may prompt before returning to the app. If that is unacceptable, ship a small native plugin.

---

## 9. Compatibility

- `@utxos/sdk`, `Web3Wallet` and `Web3NonCustodialProvider` keep their API and routes.
- v2 is opt-in through new classes and new `/api/v2` routes.
- Legacy wallets are readable through v2 chain adapters. No forced migration.
- Native sign-in for React Native keeps working while it moves into `@utxos-sdk/react-native`.

---

## 10. Roadmap

| Phase | Scope | Done when |
|---|---|---|
| 0 (done) | PKCE native hand-off, redirect whitelist on `/api/auth`, React Native sign-in | Merged: SDK #138, monorepo #605 |
| 1 | `@utxos-sdk/core` skeleton with `UtxosIdentity`, `PlatformBridge`, and `/api/v2/identity` | Sign-in works in web with no wallet created |
| 2 | `@utxos-sdk/capacitor` bridge | Google, Discord, X, email sign-in works on real iOS and Android devices, including cancel and cold-start cases |
| 3 | `/api/v2/wallet`, `ChainWallet`, `SigningGrant`, and `UtxosWallet` with the **Cardano** adapter (mainnet and testnet) | Create, connect, sign message, sign transaction, submit, disconnect, all grant-gated |
| 4 | Bitcoin and Spark adapters | Same operations, chain-specific validation tests |
| 5 | `/api/v2/project-wallet` | Developer-controlled wallets, chain and network specific |
| 6 | Package split, lazy loading, bundle size budget | Measured sign-in payload drop |
| 7 | React package, React Native move, then Flutter, iOS, Android | Same bridge contract and protocol tests |

Cross-cutting from phase 1: contract tests that every bridge passes, and a test for each of the four rules (for example: "deleting a wallet leaves the identity", "an identity session cannot sign").

---

## 11. Decisions needed

1. **npm scope:** `@utxos-sdk/*` or `@utxos/*`?
2. **Key model for chain-specific creation:** derive each chain from the existing shard-secret on demand (no new shard ceremony), or create a separate secret per chain? The first keeps one recovery story and is assumed in this document.
3. **Legacy wallets:** lazy link on first v2 `connect` (assumed here) or an explicit migration job?
4. **`wallet.connect` shape:** shorthand plus pre-bound handles (assumed here), or only one of the two?
5. **Identity providers for v2:** same list as today, or also passkeys?
6. **Capacitor on iOS:** accept `SFSafariViewController` and its prompt, or fund a native `ASWebAuthenticationSession` plugin?
7. **Repository layout:** a monorepo (`packages/*`) inside `utxos-sdk`, or separate repositories per platform?
