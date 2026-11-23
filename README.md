# UTXOS Web3 Services SDK

The official SDK for UTXOS - a Web3 infrastructure platform for UTXO-based blockchains. This SDK provides comprehensive tools for building Web3 applications with support for Bitcoin, Cardano, and Spark networks.

Visit [UTXOS](https://utxos.dev/) for more information.

## Features

- **Multi-Chain Support**: Bitcoin, Cardano, and Spark blockchains
- **Developer-Controlled Wallets**: Manage wallets on behalf of users with secure backend integration
- **User-Controlled Wallets**: Non-custodial wallet solutions with OAuth integration (Google, Twitter, Discord)
- **Transaction Sponsorship**: Sponsor transactions for gasless user experiences
- **Shard-Based Security**: Client-side key management with multi-shard encryption
- **TypeScript Native**: Full type safety and IntelliSense support

## Installation

```bash
npm install @utxos/sdk
```

## Quick Start

### User-Controlled Wallets

Enable users to create non-custodial wallets with OAuth:

```typescript
import { Web3Wallet, EnableWeb3WalletOptions } from '@utxos/sdk';

const options: EnableWeb3WalletOptions = {
  networkId: 0, // 0: TESTNET, 1: MAINNET
  projectId: process.env.NEXT_PUBLIC_UTXOS_PROJECT_ID,
};

const wallet = await Web3Wallet.enable(options);

const bitcoinWallet = wallet.bitcoin;
const cardanoWallet = wallet.cardano;
const sparkWallet = wallet.spark;
```

Check [https://docs.utxos.dev/wallet](https://docs.utxos.dev/wallet) for more details.

#### React Native (Google, Discord, X sign-in)

Google refuses sign-in inside embedded WebViews, so on React Native the wallet opens in the
**system browser** (ASWebAuthenticationSession / Chrome Custom Tabs) and returns to your app
through an app link. Pass the link as `redirectUri`:

```typescript
const wallet = await Web3Wallet.enable({
  networkId: 1,
  projectId: 'your-project-id',
  directTo: 'google',
  redirectUri: 'myapp://wallet', // or an https universal / app link
});
// The same redirectUri is reused for every later signing request on `wallet`.
```

Setup checklist:

1. Register the scheme in your app (Expo: `"scheme": "myapp"` in `app.json`; bare RN: iOS URL
   Types + an Android `intent-filter`).
2. Add the **exact** redirect URI (e.g. `myapp://wallet`) to your project's whitelisted URLs in the
   UTXOS dashboard. Wildcards and prefix matches are not supported.
3. Recommended: `npm i react-native-inappbrowser-reborn`. Without it the SDK falls back to opening
   the external browser and waiting for the deep link.
4. Prefer an https universal link / app link over a custom scheme where possible: custom schemes
   can be claimed by other apps on the same device.

How it stays secure: the redirect only carries a one-time `code` and your request's `state`. The
wallet result itself is stored server-side for 60 seconds and can only be redeemed once, by the
app that holds the PKCE `code_verifier` generated for that request (RFC 7636 / RFC 8252). Another
app that intercepts the deep link cannot redeem the code. The `redirectUri` is ignored in browsers,
which keep using the popup.

### Initialize the SDK

```typescript
import { Web3Sdk } from '@utxos/sdk';

const sdk = new Web3Sdk({
  projectId: 'your-project-id',
  apiKey: 'your-api-key',
  privateKey: 'your-private-key',
  network: 'mainnet',
});
```

### Developer-Controlled Wallets

Create and manage wallets on your backend:

```typescript
// Create a new wallet
const wallet = await sdk.wallet.create();

// Get wallet
const { info, wallet } = await sdk.wallet.getWallet("WALLET_ID", NETWORK_ID);
```

Check [https://docs.utxos.dev/wallet/developer-controlled](https://docs.utxos.dev/wallet/developer-controlled) for more details.

### Transaction Sponsorship

Sponsor transactions to provide gasless experiences:

```typescript
// Sponsor a transaction
const sponsoredTx = await sdk.sponsorship.sponsor({
  unsignedTx: transactionHex,
  chain: 'cardano',
});
```

Check [https://docs.utxos.dev/sponsor](https://docs.utxos.dev/sponsor) for more details.

## Supported Chains

- **Bitcoin**: Mainnet and Testnet
- **Cardano**: Mainnet (Preview, Preprod, Mainnet)
- **Spark**: Mainnet and Regtest

## Links

- [Documentation](https://docs.utxos.dev/)
- [Website](https://utxos.dev/)
- [GitHub Repository](https://github.com/utxos-dev/utxos-sdk)

## Support

For questions and support, join our [Discord community](https://discord.gg/WvnCNqmAxy).
