import { MeshCardanoHeadlessWallet } from "@meshsdk/wallet";
import { IssuerSparkWallet } from "@buildonspark/issuer-sdk";
import {
  MultiChainWalletInfo as ContractWalletInfo,
  validateMultiChainWalletInfo,
  isValidMultiChainWalletInfo,
} from "@utxos/api-contracts";

/**
 * Standardized network ID type (0 = testnet, 1 = mainnet)
 */
export type NetworkId = 0 | 1;

/**
 * Multi-chain wallet creation options
 */
export interface MultiChainWalletOptions {
  tags?: string[];
  networkId?: NetworkId;
}

/**
 * Multi-chain wallet information - one wallet per project with all chain keys
 * Type is imported from shared API contracts to ensure SDK/API compatibility.
 */
export type MultiChainWalletInfo = ContractWalletInfo;

// Re-export validation utilities for runtime checking
export { validateMultiChainWalletInfo, isValidMultiChainWalletInfo };

/**
 * Multi-chain wallet instance with initialized wallet objects
 */
export interface MultiChainWalletInstance {
  info: MultiChainWalletInfo;
  cardanoWallet?: MeshCardanoHeadlessWallet;
  sparkIssuerWallet?: IssuerSparkWallet;
}

/**
 * Supported chain types for wallet operations
 */
export type SupportedChain = "cardano" | "spark";
