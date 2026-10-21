// Light entry for apps that only need sign-in / session handling.
// It deliberately does NOT import the wallet generation, derivation or chain
// modules (Cardano, Bitcoin, Spark): those load on demand inside
// Web3NonCustodialProvider (see `preloadWalletCrypto`).
import { setAdapters } from "./internal/platform-context";
import { browserAdapters } from "./platforms/browser";

setAdapters(browserAdapters);

export * from "./non-custodial";
export type {
  Web3JWTBody,
  Web3WalletObject,
  Web3AuthProvider,
} from "./types";
