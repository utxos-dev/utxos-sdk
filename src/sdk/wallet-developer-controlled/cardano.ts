import { Web3Sdk } from "..";
import { MeshCardanoHeadlessWallet } from "@meshsdk/wallet";
import { decryptWithPrivateKey } from "../../functions";
import { MultiChainWalletInfo, TokenCreationParams } from "../../types";

/**
 * CardanoWalletDeveloperControlled - Manages Cardano-specific developer-controlled wallets.
 *
 * Provides wallet management operations for Cardano wallets.
 *
 * @example
 * ```typescript
 * // List all Cardano wallets
 * const wallets = await sdk.wallet.cardano.getWallets();
 *
 * // Get wallets by tag
 * const treasuryWallets = await sdk.wallet.cardano.getWalletsByTag("treasury");
 *
 * // Get a specific wallet with initialized MeshCardanoHeadlessWallet
 * const { info, wallet } = await sdk.wallet.cardano.getWallet("wallet-id");
 * const address = await wallet.getChangeAddressBech32();
 * ```
 */
export class CardanoWalletDeveloperControlled {
  readonly sdk: Web3Sdk;

  constructor({
    sdk,
  }: {
    sdk: Web3Sdk;
  }) {
    this.sdk = sdk;
  }

  /**
   * Retrieves all Cardano wallets for the project.
   *
   * @returns Promise resolving to array of wallet information
   *
   * @example
   * ```typescript
   * const wallets = await sdk.wallet.cardano.getWallets();
   * console.log(`Found ${wallets.length} Cardano wallets`);
   * ```
   */
  async getWallets(): Promise<MultiChainWalletInfo[]> {
    const { data, status } = await this.sdk.axiosInstance.get(
      `api/project-wallet/${this.sdk.projectId}/cardano`,
    );

    if (status === 200) {
      return data as MultiChainWalletInfo[];
    }

    throw new Error("Failed to get Cardano wallets");
  }

  /**
   * Retrieves a specific Cardano wallet by ID and initializes a MeshCardanoHeadlessWallet instance.
   *
   * @param walletId - The wallet ID to retrieve
   * @param decryptKey - If true, returns the decrypted mnemonic in wallet info
   * @returns Promise resolving to wallet info and initialized MeshCardanoHeadlessWallet
   *
   * @example
   * ```typescript
   * const { info, wallet } = await sdk.wallet.cardano.getWallet("wallet-id");
   * const address = await wallet.getChangeAddressBech32();
   * console.log("Base address:", address);
   * ```
   */
  async getWallet(
    walletId: string,
    decryptKey = false,
  ): Promise<{
    info: MultiChainWalletInfo;
    wallet: MeshCardanoHeadlessWallet;
  }> {
    if (this.sdk.privateKey === undefined) {
      throw new Error("Private key not found");
    }

    const { data, status } = await this.sdk.axiosInstance.get(
      `api/project-wallet/${this.sdk.projectId}/${walletId}?chain=cardano`,
    );

    if (status === 200) {
      const web3Wallet = data as MultiChainWalletInfo;

      const mnemonic = await decryptWithPrivateKey({
        privateKey: this.sdk.privateKey,
        encryptedDataJSON: web3Wallet.key,
      });

      if (decryptKey) {
        web3Wallet.key = mnemonic;
      }

      const networkId = this.sdk.network === "mainnet" ? 1 : 0;
      const wallet = await MeshCardanoHeadlessWallet.fromMnemonic({
        mnemonic: mnemonic.split(" "),
        networkId: networkId,
        walletAddressType: 1,
      });

      return { info: web3Wallet, wallet: wallet };
    }

    throw new Error("Failed to get Cardano wallet");
  }

  /**
   * Gets Cardano wallets filtered by tag.
   *
   * @param tag - The tag to filter by
   * @returns Promise resolving to array of matching wallet information
   *
   * @example
   * ```typescript
   * const wallets = await sdk.wallet.cardano.getWalletsByTag("treasury");
   * ```
   */
  async getWalletsByTag(tag: string): Promise<MultiChainWalletInfo[]> {
    if (this.sdk.privateKey === undefined) {
      throw new Error("Private key not found");
    }

    const { data, status } = await this.sdk.axiosInstance.get(
      `api/project-wallet/${this.sdk.projectId}/cardano/tag/${tag}`,
    );

    if (status === 200) {
      return data as MultiChainWalletInfo[];
    }

    throw new Error("Failed to get Cardano wallets by tag");
  }
}
