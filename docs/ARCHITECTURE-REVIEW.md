# Review of `ARCHITECTURE.md`: how it fits what we already have

Scope: `utxos-sdk` at `8cb63b8` (0.2.9) and `utxos-dev` `main` plus the native hand-off work. Everything below was checked in the code. Where I could not check something, it is listed in section 9.

## 1. Verdict

The direction is right: one backend, one protocol, thin platform adapters, signing separate from sign-in. But **most of the target architecture already exists under other names**. The v2 work should therefore be a **thin facade plus a few additive changes**, not a rewrite:

- The "platform bridge" is already `PlatformAdapters`.
- "UtxosIdentity" is already `Web3NonCustodialProvider` (sign-in) plus the `User` table.
- "Chain-specific signing" already exists as per-chain wallet-page methods (`cardano-sign-tx`, `bitcoin-sign-psbt`, `spark-transfer`, ...).
- "Connect/disconnect" already exists as `WalletAuthorization` and `/api/project-wallet-connection`.
- The identity-only bundle already exists as `@utxos/sdk/non-custodial`.

Six things in the draft should change (section 3). Two real problems are **not** in the draft: CORS for Capacitor, and shards being returned to any signed-in session (section 3, items B and C).

The rule for everything below: **a v2 route or class is a re-export or wrapper of an existing handler/class unless a table says "new"**.

## 2. What exists vs. what the draft proposes

| Draft item | Already in the code | Action |
|---|---|---|
| `UtxosIdentity` (`signIn`, `getSession`, `onChange`, `signOut`) | `Web3NonCustodialProvider`: `signInWithProvider`, `sendEmailOtp`, `verifyEmailOtp`, `handleAuthenticationRoute`, `getUser`, storage of the JWT. Sign-in itself creates no wallet. | **Wrap.** About 150 lines: normalise providers into `signIn({ provider })`, add `onChange` and `signOut`. No backend change. |
| `PlatformBridge` | `PlatformAdapters = { crypto, storage, linking, encoding }`, installed by `setAdapters`. `linking.openAuthWindow(url, redirectUri, { state, timeoutMs })` is `openAuthSession`. | **Do not add a second interface.** Keep `PlatformAdapters`. Add a Capacitor adapter that implements it (section 5). |
| Fixed protocol (PKCE, state, exact redirect, one-time code) | `functions/window/native-handoff.ts`, `functions/auth/redirect-uri.ts`, `/api/native-handoff/{create,exchange}`, and the sandbox tests in `apps/app/src/__tests__/sandbox`. | **Reuse as is.** This is the conformance suite (section 5.3). |
| `ChainAdapter` per chain | `src/chains/{cardano,bitcoin,spark}` hold address and utility code. Signing runs in the wallet page and is already split by method (`ALLOWED_METHODS` in `utils/native-handoff`). | **Group, don't rewrite.** `ChainAdapter.signTransaction` calls today's `openWindow({ method: "cardano-sign-tx" ... })`. The adapter's value is validation and typing, not a new signing path. |
| `Wallet.identityId NOT NULL` | `wallets.user_id` is already `NOT NULL`, FK to `users`, `onDelete: Cascade`. Rules 1 and 2 already hold in the schema. | **No new column.** `ChainWallet` references `userId`. |
| `ChainWallet` table | `wallets` has one row with `cardano_*`, `bitcoin_mainnet_*`, `bitcoin_testnet_*`, `spark_mainnet_*`, `spark_regtest_*` columns. | **New, additive, and only when needed** (section 7, phase 4). Not required for sign-in, Capacitor, or per-chain derive. |
| `connect` / `disconnect` | `WalletAuthorization(projectId, walletId, lastConnection, isActive)` with `/api/project-wallet-connection[/create,/[projectId]/[walletId]]`. | **Use these** for connect/disconnect state. Do not invent a new "connection" concept. |
| `SigningGrant` | JWT `scopes` (`dashboard`, project IDs) is the only authorisation today. | **New** (section 3, item C). |
| `/api/v2/identity/*` | `/api/auth`, `/api/auth/email/*`, `/api/auth/fcb`, `/api/auth/verify`, `/api/native-handoff/*`. | **Alias** (table below). |
| `/api/v2/wallet/*` | `/api/wallet`, `/api/wallet/[walletId]`, `/api/device`, `/api/user/devices`. | **Alias**, with a new response shape that omits shards (item C). |
| `/api/v2/project-wallet/*` | `/api/project-wallet/*`. The `project_wallets` table is **Cardano only** (`pub_key_hash`, `stake_credential_hash`). | **Alias** for Cardano. Other chains need a column or table change. |
| Shared request/response schemas | `packages/api-contracts` (zod): project, project-wallet, sponsorship, tokenization, plus `contract-compatibility.test.ts`. | **Put v2 schemas here.** The SDK already depends on it. |
| Identity-only bundle | `@utxos/sdk/non-custodial` entry (`non-custodial-entry.ts`) and a lazy loader for wallet crypto in `non-custodial/index.ts`. | **Already delivered.** Measure before promising more (section 6). |

### Route grouping (no new logic)

| v2 route (draft) | Existing handler | Change |
|---|---|---|
| `POST /identity/sessions` | `/api/auth` (OAuth callback), `/api/auth/email/verify-otp`, `/api/auth/fcb` | none: re-export |
| `GET /identity/me` | `/api/auth/verify` (returns the JWT payload) | add a user lookup |
| `POST /identity/email/otp` and `/verify` | `/api/auth/email/send-otp`, `/verify-otp` | none (still Pro tier, see item F) |
| `POST /identity/native-handoff/exchange` | `/api/native-handoff/exchange` | none: re-export, **keep the old path forever** (SDK 0.2.9 is in the field) |
| `GET/POST /wallet` | `/api/wallet` | new read shape (no shards); `POST` takes one chain |
| `GET /wallet/{id}` | `/api/wallet/[walletId]` | new read shape (no shards) |
| `POST /wallet/{id}/devices` | `/api/device`, `/api/user/devices` | none |
| `POST /wallet/{id}/sign-requests` | none | **new** (item C) |
| `/project-wallet/*` | `/api/project-wallet/*` | none for Cardano |

Implementation pattern: each v2 file is one line, `export { default } from "<existing handler>"`, or a shared function that both paths call. One implementation, two URLs. A bug fix lands once.

## 3. Corrections to the draft

### A. Platform logic is not mixed into the core. The coupling is the entry point.

The adapters already isolate platform code. The real problem is `src/index.ts` and `src/index.native.ts`: each calls `setAdapters(...)` as an import side effect, and `setAdapters` **ignores a second call outside development** (`platform-context.ts`). A Capacitor package therefore cannot import the main entry: it would install the browser adapters first, because a Capacitor WebView has `window`.

Fix, with no behaviour change:

1. Add `src/core-entry.ts` that exports everything `index.ts` exports **without** calling `setAdapters`.
2. `index.ts` = `core-entry` + `setAdapters(browserAdapters)`. `index.native.ts` = `core-entry` + RN adapters. Public exports stay identical.
3. Add `index.capacitor.ts` = `core-entry` + Capacitor adapters.
4. Guard with a test that snapshots the export names of `index.ts` and `index.native.ts` before and after.

### B. Capacitor will fail on CORS before it fails on anything else (not in the draft).

React Native `fetch` has no CORS. A Capacitor WebView does, and its origin is `capacitor://localhost` (iOS) or `https://localhost` / `http://localhost` (Android). `apps/app/src/middleware.ts` only allows `NEXT_PUBLIC_ORIGIN` plus the `CORS_ALLOWED_ORIGINS` env list, and answers `403` to preflights from anything else. The calls a Capacitor app makes (`/api/native-handoff/exchange`, email OTP, wallet and device APIs) will all be blocked.

Do not put `localhost` origins into the global list: any local web page could then call the credentialed APIs. Instead:

- `/api/native-handoff/exchange`: allow any origin, **without credentials**. It is already PKCE-protected, does not use cookies, and the SDK sends no credentials. This is safe and is the only endpoint the sign-in return trip needs.
- Email OTP and identity endpoints: allow the Capacitor origins **per project** (extend the project whitelist handling), or require the app to proxy them. Needs a decision (section 8).
- Test it in the sandbox: add an `Origin: capacitor://localhost` case.

### C. The signing model needs one more step than the draft shows.

The draft says "key shards are assembled in the wallet context". Today:

- `GET /api/wallet` and `GET /api/wallet/[walletId]` return the **whole row**, including `authShard` and `recoveryShard`, to any session with the project scope.
- `combineShardsBuildWallet` combines the device shard and the custodial shard (`authShard`) in the browser.

So the server cannot tell "signed in" from "about to sign". A signing grant that is only checked when the app asks for one gives no protection, because the shard is already available.

Therefore a grant must **gate the shard**:

1. v2 wallet reads return public fields only. No `authShard`, no `recoveryShard`.
2. `POST /api/v2/wallet/{id}/sign-requests` (identity session, `chain`, `network`, `payloadHash`) returns a grant ID.
3. The custodial shard is released only by redeeming a grant: single use, 60 seconds, bound to the payload hash.
4. Legacy endpoints are untouched, so old SDKs keep working (and keep today's exposure). Retiring that is a separate, later decision.

This is the biggest piece of new backend work. It is also what makes rule 4 real instead of cosmetic.

### D. Load: sign-in is not the heavy part. Wallet init is.

- `Web3NonCustodialProvider` sign-in derives nothing, and wallet crypto is already loaded lazily (comment at the top of `non-custodial/index.ts`).
- `combineShardsBuildWallet` **always** builds three wallets: `EmbeddedWallet` (Bitcoin), `MeshCardanoHeadlessWallet` (Cardano) and `SparkWallet.initialize` (Spark, which also makes network calls). A Cardano-only app pays for Bitcoin and Spark on every connect and sign.
- `index.native.ts` re-exports `SparkWallet` and the issuer types eagerly, so every React Native bundle contains the Spark SDK.

Highest-value, lowest-risk speed-ups, all additive:

1. `combineShardsBuildWallet(..., { chains?: ("cardano" | "bitcoin" | "spark")[] })`, **default all**, so current callers behave the same. Same for `clientDeriveWallet`. This is the "derive only what was asked" rule from section 7 of the draft, done as an optional argument instead of a new API.
2. The wallet page passes the chain implied by the method (`cardano-sign-tx` -> cardano).
3. Move the Spark re-exports in `index.native.ts` behind a subpath (`@utxos/sdk/spark`) and keep the old names exported for one release as lazy getters if the bundler allows it. If not, document it as a minor-version change.

### E. Packages and scope: keep one package with subpaths first.

The draft proposes `@utxos-sdk/*`, a new npm scope, and many packages. The repo already splits by subpath (`./non-custodial`, `./redirect-uri`), built by one multi-entry `tsup`. Recommendation:

- Stay on `@utxos/sdk` and add subpaths: `/identity`, `/wallet`, `/chains/cardano`, `/chains/bitcoin`, `/chains/spark`, `/capacitor`, `/react`.
- Optional peer dependencies for platform plugins (`@capacitor/browser`, `@capacitor/app`), listed under `external` in `tsup.config.ts`, as the React Native ones already are.
- One repo, one version, one submodule pointer in `utxos-dev`. No version skew between core and chain packages.
- Split into real packages only if a measured bundle budget needs it (draft phase 6).

This answers open decisions 1 and 7: no new scope, no multi-repo.

### F. Provider availability and tiers.

Email sign-in requires a Pro project (`isEmailAuthAvailable`, `403 TIER_REQUIRED`). `signIn({ provider: "email" })` must surface that error with a stable code, and the SDK should be able to read which providers a project has enabled from `getPublicProjectDetails` (it already returns branding and OAuth clients). Do not assume all five providers work on every project.

### G. Smaller notes

- `Wallet -> User` is `onDelete: Cascade`. Rule 3 ("a wallet never deletes its identity") holds. The reverse (deleting a user deletes wallets) is existing behaviour. Leave it. `ChainWallet` can use `Restrict` because it is new.
- The draft's "Wallet lifecycle: status" has no equivalent today (`WalletAuthorization.isActive` is the nearest). Add `status` to `ChainWallet` only.
- Project wallets are Cardano-only in the schema. "Chain and network specific project wallets" is a schema change; schedule it after the identity and wallet phases.

## 4. Non-breaking guardrails

1. **Export-surface snapshot** for `@utxos/sdk` (browser and native). A PR that changes it fails.
2. **Route additions only.** No edits to the semantics of existing `/api/*` handlers. v2 files re-export.
3. **`contract-compatibility.test.ts`** in `api-contracts` stays green. Extend it for each new schema.
4. **Schema changes are additive** and go through the Prisma migration workflow in this repo. Deploying migrations stays a manual step.
5. **Sandbox tests** (`npm run test:sandbox`) run on every change to hand-off, auth, or an adapter.
6. **Legacy SDK matrix**: keep a CI job that runs the previous SDK minor against the new backend's legacy routes.

## 5. Multi-platform design

### 5.1 Principle

Platform differences are exactly four adapters: `linking`, `storage`, `crypto`, `encoding`. Everything above them is shared. A new platform is a new adapter set plus an entry file. It never edits the core.

### 5.2 Platform matrix

| Platform | Adapters | Sign-in return path | Status |
|---|---|---|---|
| Web / React | browser (`linking.browser`: popup + `postMessage`) | popup | **Works today.** A `/react` subpath adds hooks over `UtxosIdentity` only. |
| React Native | RN (`linking.native`: system browser, deep link, PKCE) | custom scheme or https link | **Works today** (SDK #138, monorepo #605). |
| Capacitor | browser `crypto` + `encoding`, new `linking` and `storage` | custom scheme | **First new platform.** Needs item A (entry) and item B (CORS). |
| Node / server | none needed for developer-controlled wallets | none | Works today (`sdk/wallet-developer-controlled`). |
| Flutter / iOS / Android | no JS SDK possible for signing (Shamir, AES and the chain libraries are TypeScript) | system browser + the same HTTP protocol | **Identity and hand-off only.** Signing opens the wallet page in the system browser, like React Native today. Native signing would mean porting the key code. Decide before promising it. |

### 5.3 Capacitor adapter (small, because most parts are reusable)

- `crypto`, `encoding`: reuse the browser adapters. A WebView has `crypto.subtle`.
- `linking.openAuthWindow`: `Browser.open({ url })` from `@capacitor/browser`, then wait for `App.addListener("appUrlOpen")`. Reuse `parseRedirectCallback` and `safeEqual` unchanged. Set `supportsRedirectCallback = true` so `openWindow` takes the existing PKCE path. Call `Browser.close()` after the callback.
- Android: `browserFinished` can fire before `appUrlOpen`. Treat it as a cancel only after a short grace period (the draft is right about this).
- `storage`: `localStorage` in a WebView is not secure storage. Use `@capacitor/preferences` as the minimum, with a documented option for a secure-storage plugin.
- iOS limitation (draft section 8) is real: `@capacitor/browser` uses `SFSafariViewController`, not `ASWebAuthenticationSession`. Prefer a custom scheme and test on devices.

### 5.4 Conformance suite

The sandbox in `utxos-dev` (`apps/app/src/__tests__/sandbox`) already runs: happy path, replay, intercepted link, forged `state`, wrong scheme, non-whitelisted redirect, malformed request, `access_denied`. Turn the platform-independent part into a **bridge conformance test**: each platform adapter must pass the same scenarios against a fake browser. Capacitor and any future adapter then prove themselves in CI without a device. Device testing is still needed for the OS-specific cases (cold start, Android browser close, iOS prompt).

## 6. Speed: what to do in what order

| Step | Effect | Risk |
|---|---|---|
| Measure first: bundle size of `@utxos/sdk`, `@utxos/sdk/non-custodial`, RN build | A baseline so claims are checkable | none |
| `chains?` option in `combineShardsBuildWallet` / `clientDeriveWallet` (item D.1, D.2) | Removes Spark network init and Bitcoin setup for single-chain use | low, default unchanged |
| Spark re-exports out of `index.native.ts` (D.3) | Smaller RN bundle | low to medium (export change, needs a note) |
| Per-chain subpaths (item E) | Cardano-only apps do not load Bitcoin or Spark code | low, additive |
| Identity-only entry (`/identity` over the existing `non-custodial` entry) | Sign-in bundle without wallet code | none, already mostly true |
| Wallet UI loads only for signing | Already how sign-in via provider works | none |

## 7. Phases (adjusted)

| Phase | Work | Breaks anything? |
|---|---|---|
| 0 | Done: PKCE hand-off, whitelist on `/api/auth`, sandbox tests | no |
| 1 | `core-entry.ts` + entry files (item A) + export snapshot test + bundle baseline | no |
| 2 | Capacitor adapter + `index.capacitor.ts` + CORS for `exchange` (items A, B) + conformance suite | no |
| 3 | `UtxosIdentity` facade over `Web3NonCustodialProvider`, `/api/v2/identity/*` as re-exports, `@utxos/sdk/identity` subpath | no |
| 4 | `chains?` option (item D), per-chain subpaths, `ChainAdapter` wrapping today's methods, v2 wallet read shape without shards | no (legacy untouched) |
| 5 | `SigningGrant` table, `sign-requests`, shard release behind grants (item C), `ChainWallet` only if per-chain rows are still needed | additive schema |
| 6 | Project wallets beyond Cardano (schema change), React subpath, then Flutter/iOS/Android identity | additive schema |

Phases 1 to 3 touch no database and no legacy route. That is the safest place to start and delivers Capacitor.

## 8. Decisions: my recommendation for each

| # | Draft question | Recommendation |
|---|---|---|
| 1 | npm scope | Keep `@utxos/*`. No new scope. |
| 2 | Key model | Derive each chain from the existing shard secret on demand (draft's assumption). It matches `combineShardsBuildWallet`, which already derives all chains from one mnemonic. |
| 3 | Legacy wallets | Lazy: expose the existing `wallets` row for the requested chain. No migration job. |
| 4 | `connect` shape | Both: handles are the same call as `connect`. Cheap to support. |
| 5 | Providers | Same list as today. Passkeys later, behind the same `signIn` option. `webauthnCredentialId` already exists on `wallets`. |
| 6 | Capacitor on iOS | Ship `SFSafariViewController` first, measure the prompt on devices, build a plugin only if it is unacceptable. |
| 7 | Layout | One repo, subpath exports. |
| new | Capacitor CORS | Open `exchange` without credentials; per-project origins for the rest (item B). Needs your call. |
| new | Legacy shard exposure | Leave legacy endpoints as they are; do not return shards from v2 (item C). Decide a retirement date separately. |

## 9. Not verified / needs your confirmation

- Which route mints tokens that include a **third-party project ID in `scopes`**. `authenticateUserAfterOAuth2Success` adds `projectId` only for FCB; for Google, Discord and X the token carries `dashboard` and the platform project ID. Wallet endpoints check `scopes.includes(projectId)`. I did not trace how third-party projects get that scope, and the sign-in design (and the "identity" scope) depends on it.
- Whether `authShard` alone, without the device shard, is enough to reconstruct a signing key. By the code it is one of two Shamir shares (`combineShardsBuildWallet(keyShard1, keyShard2)`), so I assume no. Please confirm before treating item C as a vulnerability rather than a design gap.
- Capacitor behaviour on real devices (cold start, Android back button, iOS prompt). Nothing here was run on a device.
- The `/react` hooks package: no code exists yet, so only the scope is described.
