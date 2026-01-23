import { Web3Sdk } from "..";
import {
  MultiChainWalletInfo,
  MultiChainWalletInstance,
  SupportedChain,
} from "../../types/core/multi-chain";
import { CardanoWalletDeveloperControlled } from "./cardano";
import { SparkIssuerWalletDeveloperControlled } from "./spark-issuer";
import { MeshWallet } from "@meshsdk/wallet";
import { IssuerSparkWallet } from "@buildonspark/issuer-sdk";
import { deserializeBech32Address } from "@meshsdk/core-cst";
import { encryptWithPublicKey, decryptWithPrivateKey } from "../../functions";
import { v4 as uuidv4 } from "uuid";

/**
 * The `WalletDeveloperControlled` class provides functionality for managing developer-controlled wallets
 * within a Web3 project. Supports multi-chain wallets with a shared mnemonic for Spark and Cardano.
 *
 * @example
 * ```typescript
 * // Create a new multi-chain wallet
 * const { info, sparkIssuerWallet, cardanoWallet } = await sdk.wallet.createWallet({
 *   tags: ["treasury"],
 * });
 *
 * // Load an existing wallet by ID
 * const { info, sparkWallet, cardanoWallet } = await sdk.wallet.initWallet("wallet-id");
 *
 * // Get a wallet for a specific chain
 * const { cardanoWallet } = await sdk.wallet.getWallet("wallet-id", "cardano");
 * const { sparkIssuerWallet } = await sdk.wallet.getWallet("wallet-id", "spark");
 * const sparkAddress = await sparkIssuerWallet.getSparkAddress();
 *
 * // List all project wallets
 * const wallets = await sdk.wallet.getProjectWallets();
 * ```
 */
export class WalletDeveloperControlled {
  readonly sdk: Web3Sdk;
  cardano: CardanoWalletDeveloperControlled;
  sparkIssuer: SparkIssuerWalletDeveloperControlled;

  constructor({ sdk }: { sdk: Web3Sdk }) {
    this.sdk = sdk;
    this.cardano = new CardanoWalletDeveloperControlled({ sdk });
    this.sparkIssuer = new SparkIssuerWalletDeveloperControlled({ sdk });
  }

  /**
   * Creates a new developer-controlled wallet with both Spark and Cardano chains using shared mnemonic.
   *
   * @param options - Wallet creation options
   * @param options.tags - Optional tags for the wallet
   * @returns Promise that resolves to wallet info and chain wallet instances
   *
   * @example
   * ```typescript
   * // Create wallet
   * const { info } = await sdk.wallet.createWallet({ tags: ["tokenization"] });
   *
   * // For tokenization, use initWallet then createToken
   * await sdk.tokenization.spark.initWallet({ walletId: info.id });
   * await sdk.tokenization.spark.createToken({
   *   tokenName: "MyToken",
   *   tokenTicker: "MTK",
   *   decimals: 8,
   *   isFreezable: true
   * });
   * ```
   */
  async createWallet(
    options: {
      tags?: string[];
    } = {},
  ): Promise<{
    info: MultiChainWalletInfo;
    sparkIssuerWallet: IssuerSparkWallet;
    cardanoWallet: MeshWallet;
  }> {
    const project = await this.sdk.getProject();
    if (!project.publicKey) {
      throw new Error("Project public key not found");
    }

    const networkId = this.sdk.network === "mainnet" ? 1 : 0;
    const walletId = uuidv4();
    const mnemonic = MeshWallet.brew() as string[];
    const encryptedKey = await encryptWithPublicKey({
      publicKey: project.publicKey,
      data: mnemonic.join(" "),
    });

    const cardanoWallet = new MeshWallet({
      networkId: networkId,
      key: { type: "mnemonic", words: mnemonic },
      fetcher: this.sdk.providerFetcher,
      submitter: this.sdk.providerSubmitter,
    });
    await cardanoWallet.init();

    const [{ wallet: sparkMainnetWallet }, { wallet: sparkRegtestWallet }] =
      await Promise.all([
        IssuerSparkWallet.initialize({
          mnemonicOrSeed: mnemonic.join(" "),
          options: { network: "MAINNET" },
        }),
        IssuerSparkWallet.initialize({
          mnemonicOrSeed: mnemonic.join(" "),
          options: { network: "REGTEST" },
        }),
      ]);

    const addresses = cardanoWallet.getAddresses();
    const { pubKeyHash, stakeCredentialHash } = deserializeBech32Address(
      addresses.baseAddressBech32!,
    );
    const [mainnetPublicKey, regtestPublicKey] = await Promise.all([
      sparkMainnetWallet.getIdentityPublicKey(),
      sparkRegtestWallet.getIdentityPublicKey(),
    ]);

    const sparkWallet =
      networkId === 1 ? sparkMainnetWallet : sparkRegtestWallet;

    const walletData: MultiChainWalletInfo = {
      id: walletId,
      projectId: this.sdk.projectId,
      tags: options.tags || [],
      key: encryptedKey,
      chains: {
        cardano: { pubKeyHash, stakeCredentialHash },
        spark: { mainnetPublicKey, regtestPublicKey },
      },
    };

    const { status } = await this.sdk.axiosInstance.post(
      `api/project-wallet`,
      walletData,
    );

    if (status === 200) {
      return {
        info: walletData,
        sparkIssuerWallet: sparkWallet,
        cardanoWallet: cardanoWallet,
      };
    }

    throw new Error("Failed to create wallet");
  }

  /**
   * Loads an existing developer-controlled wallet by ID and returns both chain wallet instances.
   *
   * @param walletId - The wallet ID to load
   * @returns Promise that resolves to wallet info and initialized wallet instances
   *
   * @example
   * ```typescript
   * const { info, sparkWallet, cardanoWallet } = await sdk.wallet.initWallet("wallet-id");
   *
   * // Get Spark wallet address
   * const sparkAddress = await sparkWallet.getSparkAddress();
   *
   * // Get Cardano wallet addresses
   * const addresses = cardanoWallet.getAddresses();
   * ```
   */
  async initWallet(walletId: string): Promise<{
    info: MultiChainWalletInfo;
    sparkWallet: IssuerSparkWallet;
    cardanoWallet: MeshWallet;
  }> {
    if (!this.sdk.privateKey) {
      throw new Error(
        "Private key required to load developer-controlled wallet",
      );
    }

    const walletInfo = await this.getProjectWallet(walletId);
    const effectiveNetworkId = this.sdk.network === "mainnet" ? 1 : 0;
    const sharedMnemonic = await decryptWithPrivateKey({
      privateKey: this.sdk.privateKey,
      encryptedDataJSON: walletInfo.key,
    });

    const cardanoWallet = new MeshWallet({
      networkId: effectiveNetworkId,
      key: { type: "mnemonic", words: sharedMnemonic.split(" ") },
      fetcher: this.sdk.providerFetcher,
      submitter: this.sdk.providerSubmitter,
    });
    await cardanoWallet.init();

    const sparkNetwork = effectiveNetworkId === 1 ? "MAINNET" : "REGTEST";
    const { wallet: sparkWallet } = await IssuerSparkWallet.initialize({
      mnemonicOrSeed: sharedMnemonic,
      options: { network: sparkNetwork },
    });

    return {
      info: walletInfo,
      sparkWallet,
      cardanoWallet,
    };
  }

  /**
   * Retrieves a multi-chain wallet for a specific chain.
   *
   * @param walletId - The unique identifier of the wallet
   * @param chain - The chain to load ("spark" or "cardano")
   * @returns Promise that resolves to multi-chain wallet instance
   *
   * @example
   * ```typescript
   * // Load Spark wallet
   * const { sparkIssuerWallet } = await sdk.wallet.getWallet("wallet-id", "spark");
   *
   * // Load Cardano wallet
   * const { cardanoWallet } = await sdk.wallet.getWallet("wallet-id", "cardano");
   * ```
   */
  async getWallet(
    projectWalletId: string,
    chain: SupportedChain,
  ): Promise<MultiChainWalletInstance> {
    const walletInfo = await this.getProjectWallet(projectWalletId);

    const instance: MultiChainWalletInstance = {
      info: walletInfo,
    };

    let mnemonic: string | null = null;
    if (this.sdk.privateKey) {
      mnemonic = await decryptWithPrivateKey({
        privateKey: this.sdk.privateKey,
        encryptedDataJSON: walletInfo.key,
      });
    }

    const networkId = this.sdk.network === "mainnet" ? 1 : 0;

    if (
      (chain === "cardano" || !chain) &&
      walletInfo.chains.cardano &&
      mnemonic
    ) {
      const cardanoWallet = new MeshWallet({
        networkId: networkId,
        key: { type: "mnemonic", words: mnemonic.split(" ") },
        fetcher: this.sdk.providerFetcher,
        submitter: this.sdk.providerSubmitter,
      });
      await cardanoWallet.init();

      instance.cardanoWallet = cardanoWallet;
    }

    if ((chain === "spark" || !chain) && walletInfo.chains.spark && mnemonic) {
      const sparkNetwork = networkId === 1 ? "MAINNET" : "REGTEST";
      const { wallet: sparkWallet } = await IssuerSparkWallet.initialize({
        mnemonicOrSeed: mnemonic,
        options: { network: sparkNetwork },
      });

      instance.sparkIssuerWallet = sparkWallet;
    }

    return instance;
  }

  /**
   * Retrieves wallet metadata by ID.
   *
   * @param walletId - The unique identifier of the wallet
   * @returns Promise that resolves to wallet info
   */
  async getProjectWallet(walletId: string): Promise<MultiChainWalletInfo> {
    const { data, status } = await this.sdk.axiosInstance.get(
      `api/project-wallet/${this.sdk.projectId}/${walletId}`,
    );

    if (status === 200) {
      return data as MultiChainWalletInfo;
    }

    throw new Error("Project wallet not found");
  }

  /**
   * Retrieves wallets for the project with pagination support.
   *
   * @param options - Pagination options
   * @param options.page - Page number (default: 1)
   * @param options.pageSize - Number of wallets per page (default: 10)
   * @returns Promise that resolves to paginated wallet response
   *
   * @example
   * ```typescript
   * // Get first page of wallets
   * const { data, pagination } = await sdk.wallet.getProjectWallets();
   *
   * // Get specific page
   * const { data, pagination } = await sdk.wallet.getProjectWallets({ page: 2 });
   *
   * // Iterate through all pages
   * let page = 1;
   * let allWallets: MultiChainWalletInfo[] = [];
   * while (true) {
   *   const { data, pagination } = await sdk.wallet.getProjectWallets({ page });
   *   allWallets.push(...data);
   *   if (page >= pagination.totalPages) break;
   *   page++;
   * }
   * ```
   */
  async getProjectWallets(options?: { page?: number }): Promise<{
    data: MultiChainWalletInfo[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const page = options?.page ?? 1;
    const { data, status } = await this.sdk.axiosInstance.get(
      `api/project-wallet/${this.sdk.projectId}?page=${page}`,
    );

    if (status === 200) {
      return data as {
        data: MultiChainWalletInfo[];
        pagination: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
        };
      };
    }

    throw new Error("Failed to get project wallets");
  }

  /**
   * Retrieves all wallets for the project (fetches all pages).
   *
   * @returns Promise that resolves to array of all wallet info
   *
   * @example
   * ```typescript
   * const wallets = await sdk.wallet.getAllProjectWallets();
   * console.log(`Found ${wallets.length} wallets`);
   * ```
   */
  async getAllProjectWallets(): Promise<MultiChainWalletInfo[]> {
    const allWallets: MultiChainWalletInfo[] = [];
    let page = 1;

    while (true) {
      const { data, pagination } = await this.getProjectWallets({ page });
      allWallets.push(...data);

      if (page >= pagination.totalPages) break;
      page++;
    }

    return allWallets;
  }
}

export { CardanoWalletDeveloperControlled } from "./cardano";
export { SparkIssuerWalletDeveloperControlled } from "./spark-issuer";
