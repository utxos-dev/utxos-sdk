// Mock uuid before imports
jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-wallet-id-uuid"),
}));

// Mock external wallet SDKs
const mockCardanoWalletInstance = {
  getChangeAddressBech32: jest.fn().mockResolvedValue(
    "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
  ),
};

jest.mock("@meshsdk/wallet", () => ({
  MeshCardanoHeadlessWallet: {
    fromMnemonic: jest.fn().mockResolvedValue(mockCardanoWalletInstance),
  },
}));

jest.mock("@meshsdk/common", () => ({
  generateMnemonic: jest.fn().mockResolvedValue(
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  ),
}));

jest.mock("@meshsdk/core-cst", () => ({
  deserializeBech32Address: jest.fn().mockReturnValue({
    pubKeyHash: "mock-cardano-pub-key-hash",
    stakeCredentialHash: "mock-cardano-stake-hash",
  }),
}));

jest.mock("@buildonspark/issuer-sdk", () => ({
  IssuerSparkWallet: {
    initialize: jest.fn().mockResolvedValue({
      wallet: {
        getIdentityPublicKey: jest.fn().mockResolvedValue("mock-spark-pub-key"),
        getSparkAddress: jest.fn().mockResolvedValue("mock-spark-address"),
      },
    }),
  },
}));

// Mock encryption functions
const mockEncryptedData = JSON.stringify({
  ephemeralPublicKey: "mock-ephemeral-key",
  iv: "mock-iv",
  ciphertext: "mock-ciphertext",
});

jest.mock("../../functions", () => ({
  encryptWithPublicKey: jest.fn().mockResolvedValue(mockEncryptedData),
  decryptWithPrivateKey: jest.fn().mockResolvedValue(
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  ),
}));

// Import after mocks
import { WalletDeveloperControlled } from "./index";
import { Web3Sdk } from "../index";
import { MeshCardanoHeadlessWallet } from "@meshsdk/wallet";
import { generateMnemonic } from "@meshsdk/common";
import { IssuerSparkWallet } from "@buildonspark/issuer-sdk";
import { encryptWithPublicKey, decryptWithPrivateKey } from "../../functions";
import { v4 as uuidv4 } from "uuid";

// Mock axios
jest.mock("axios", () => ({
  create: jest.fn().mockReturnValue({
    get: jest.fn(),
    post: jest.fn(),
  }),
}));

// Helper to create mock SDK with configurable properties
function createMockSdk(overrides: {
  network?: "mainnet" | "testnet";
  privateKey?: string | undefined;
  axiosInstance?: { get: jest.Mock; post: jest.Mock };
}) {
  const axiosInstance = overrides.axiosInstance || {
    get: jest.fn(),
    post: jest.fn(),
  };
  return {
    projectId: "test-project-id",
    apiKey: "test-api-key",
    network: overrides.network ?? "testnet",
    privateKey: overrides.privateKey ?? "mock-private-key",
    axiosInstance,
    providerFetcher: undefined,
    providerSubmitter: undefined,
    getProject: jest.fn().mockResolvedValue({
      id: "test-project-id",
      publicKey: "mock-public-key",
    }),
  } as unknown as Web3Sdk;
}

describe("WalletDeveloperControlled", () => {
  let mockAxiosInstance: {
    get: jest.Mock;
    post: jest.Mock;
  };
  let mockSdk: Web3Sdk;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    };

    mockSdk = createMockSdk({ axiosInstance: mockAxiosInstance });
  });

  describe("constructor", () => {
    it("creates instance with sdk reference", () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      expect(wallet.sdk).toBe(mockSdk);
      expect(wallet.cardano).toBeDefined();
      expect(wallet.sparkIssuer).toBeDefined();
    });
  });

  describe("createWallet", () => {
    beforeEach(() => {
      mockAxiosInstance.post.mockResolvedValue({ status: 200, data: {} });
    });

    it("creates a new multi-chain wallet", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.createWallet();

      expect(result).toHaveProperty("info");
      expect(result).toHaveProperty("sparkIssuerWallet");
      expect(result).toHaveProperty("cardanoWallet");
    });

    it("generates a new mnemonic using generateMnemonic", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.createWallet();

      expect(generateMnemonic).toHaveBeenCalledWith(256);
    });

    it("encrypts mnemonic with project public key", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.createWallet();

      expect(encryptWithPublicKey).toHaveBeenCalledWith({
        publicKey: "mock-public-key",
        data: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      });
    });

    it("creates wallet with testnet configuration", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.createWallet();

      expect(MeshCardanoHeadlessWallet.fromMnemonic).toHaveBeenCalledWith(
        expect.objectContaining({ networkId: 0 }),
      );
    });

    it("creates wallet with mainnet configuration", async () => {
      const mainnetSdk = createMockSdk({
        network: "mainnet",
        axiosInstance: mockAxiosInstance,
      });
      const wallet = new WalletDeveloperControlled({ sdk: mainnetSdk });

      await wallet.createWallet();

      expect(MeshCardanoHeadlessWallet.fromMnemonic).toHaveBeenCalledWith(
        expect.objectContaining({ networkId: 1 }),
      );
    });

    it("initializes Spark wallets for both mainnet and regtest", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.createWallet();

      expect(IssuerSparkWallet.initialize).toHaveBeenCalledTimes(2);
      expect(IssuerSparkWallet.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { network: "MAINNET" },
        }),
      );
      expect(IssuerSparkWallet.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { network: "REGTEST" },
        }),
      );
    });

    it("posts wallet data to API", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.createWallet();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "api/project-wallet",
        expect.objectContaining({
          id: "mock-wallet-id-uuid",
          projectId: "test-project-id",
          key: mockEncryptedData,
        }),
      );
    });

    it("includes tags in wallet data when provided", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.createWallet({ tags: ["treasury", "main"] });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "api/project-wallet",
        expect.objectContaining({
          tags: ["treasury", "main"],
        }),
      );
    });

    it("includes chain information in wallet data", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.createWallet();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "api/project-wallet",
        expect.objectContaining({
          chains: {
            cardano: {
              pubKeyHash: "mock-cardano-pub-key-hash",
              stakeCredentialHash: "mock-cardano-stake-hash",
            },
            spark: {
              mainnetPublicKey: "mock-spark-pub-key",
              regtestPublicKey: "mock-spark-pub-key",
            },
          },
        }),
      );
    });

    it("returns regtest spark wallet for testnet", async () => {
      const testnetSdk = createMockSdk({
        network: "testnet",
        axiosInstance: mockAxiosInstance,
      });
      const wallet = new WalletDeveloperControlled({ sdk: testnetSdk });

      const result = await wallet.createWallet();

      expect(result.sparkIssuerWallet).toBeDefined();
    });

    it("throws if project public key not found", async () => {
      (mockSdk.getProject as jest.Mock).mockResolvedValue({
        id: "test-project-id",
        publicKey: null,
      });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await expect(wallet.createWallet()).rejects.toThrow(
        "Project public key not found",
      );
    });

    it("throws if API call fails", async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 500 });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await expect(wallet.createWallet()).rejects.toThrow(
        "Failed to create wallet",
      );
    });
  });

  describe("initWallet", () => {
    const mockWalletInfo = {
      id: "test-wallet-id",
      projectId: "test-project-id",
      tags: ["test"],
      key: mockEncryptedData,
      chains: {
        cardano: {
          pubKeyHash: "mock-cardano-pub-key-hash",
          stakeCredentialHash: "mock-cardano-stake-hash",
        },
        spark: {
          mainnetPublicKey: "mock-spark-pub-key",
          regtestPublicKey: "mock-spark-pub-key",
        },
      },
    };

    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockWalletInfo,
      });
    });

    it("loads existing wallet by ID", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.initWallet("test-wallet-id");

      expect(result).toHaveProperty("info");
      expect(result).toHaveProperty("sparkWallet");
      expect(result).toHaveProperty("cardanoWallet");
    });

    it("calls API to get wallet info", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.initWallet("test-wallet-id");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "api/project-wallet/test-project-id/test-wallet-id",
      );
    });

    it("decrypts mnemonic with private key", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.initWallet("test-wallet-id");

      expect(decryptWithPrivateKey).toHaveBeenCalledWith({
        privateKey: "mock-private-key",
        encryptedDataJSON: mockEncryptedData,
      });
    });

    it("creates MeshCardanoHeadlessWallet with decrypted mnemonic", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.initWallet("test-wallet-id");

      expect(MeshCardanoHeadlessWallet.fromMnemonic).toHaveBeenCalledWith(
        expect.objectContaining({
          mnemonic: [
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "abandon",
            "about",
          ],
        }),
      );
    });

    it("initializes Spark wallet with correct network for testnet", async () => {
      const testnetSdk = createMockSdk({
        network: "testnet",
        axiosInstance: mockAxiosInstance,
      });
      const wallet = new WalletDeveloperControlled({ sdk: testnetSdk });

      await wallet.initWallet("test-wallet-id");

      expect(IssuerSparkWallet.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { network: "REGTEST" },
        }),
      );
    });

    it("initializes Spark wallet with correct network for mainnet", async () => {
      const mainnetSdk = createMockSdk({
        network: "mainnet",
        axiosInstance: mockAxiosInstance,
      });
      const wallet = new WalletDeveloperControlled({ sdk: mainnetSdk });

      await wallet.initWallet("test-wallet-id");

      expect(IssuerSparkWallet.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { network: "MAINNET" },
        }),
      );
    });

    it("throws if private key not provided", async () => {
      // Need to create SDK without privateKey AND ensure getProject is called
      const noPrivateKeyAxios = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: {
            id: "test-wallet-id",
            projectId: "test-project-id",
            tags: [],
            key: mockEncryptedData,
            chains: {
              cardano: { pubKeyHash: "mock", stakeCredentialHash: "mock" },
              spark: { mainnetPublicKey: "mock", regtestPublicKey: "mock" },
            },
          },
        }),
        post: jest.fn(),
      };
      const noPrivateKeySdk = {
        projectId: "test-project-id",
        apiKey: "test-api-key",
        network: "testnet" as const,
        privateKey: undefined, // No private key
        axiosInstance: noPrivateKeyAxios,
        providerFetcher: undefined,
        providerSubmitter: undefined,
        getProject: jest.fn().mockResolvedValue({
          id: "test-project-id",
          publicKey: "mock-public-key",
        }),
      } as unknown as Web3Sdk;
      const wallet = new WalletDeveloperControlled({ sdk: noPrivateKeySdk });

      await expect(wallet.initWallet("test-wallet-id")).rejects.toThrow(
        "Private key required to load developer-controlled wallet",
      );
    });
  });

  describe("getWallet", () => {
    const mockWalletInfo = {
      id: "test-wallet-id",
      projectId: "test-project-id",
      tags: [],
      key: mockEncryptedData,
      chains: {
        cardano: {
          pubKeyHash: "mock-cardano-pub-key-hash",
          stakeCredentialHash: "mock-cardano-stake-hash",
        },
        spark: {
          mainnetPublicKey: "mock-spark-pub-key",
          regtestPublicKey: "mock-spark-pub-key",
        },
      },
    };

    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockWalletInfo,
      });
    });

    it("returns wallet instance for cardano chain", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.getWallet("test-wallet-id", "cardano");

      expect(result).toHaveProperty("info");
      expect(result).toHaveProperty("cardanoWallet");
    });

    it("returns wallet instance for spark chain", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.getWallet("test-wallet-id", "spark");

      expect(result).toHaveProperty("info");
      expect(result).toHaveProperty("sparkIssuerWallet");
    });

    it("decrypts mnemonic when private key available", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await wallet.getWallet("test-wallet-id", "cardano");

      expect(decryptWithPrivateKey).toHaveBeenCalled();
    });

    it("returns info only when no private key", async () => {
      const noPrivateKeySdk = {
        projectId: "test-project-id",
        apiKey: "test-api-key",
        network: "testnet" as const,
        privateKey: undefined, // No private key
        axiosInstance: mockAxiosInstance,
        providerFetcher: undefined,
        providerSubmitter: undefined,
        getProject: jest.fn().mockResolvedValue({
          id: "test-project-id",
          publicKey: "mock-public-key",
        }),
      } as unknown as Web3Sdk;
      const wallet = new WalletDeveloperControlled({ sdk: noPrivateKeySdk });

      const result = await wallet.getWallet("test-wallet-id", "cardano");

      expect(result.info).toBeDefined();
      expect(result.cardanoWallet).toBeUndefined();
    });
  });

  describe("getProjectWallet", () => {
    it("fetches wallet by ID from API", async () => {
      const mockWalletInfo = {
        id: "test-wallet-id",
        projectId: "test-project-id",
      };
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockWalletInfo,
      });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.getProjectWallet("test-wallet-id");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "api/project-wallet/test-project-id/test-wallet-id",
      );
      expect(result).toEqual(mockWalletInfo);
    });

    it("throws if wallet not found", async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 404 });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await expect(wallet.getProjectWallet("nonexistent")).rejects.toThrow(
        "Project wallet not found",
      );
    });
  });

  describe("getProjectWallets", () => {
    it("fetches wallets with pagination", async () => {
      const mockWallets = [
        { id: "wallet-1", projectId: "test-project-id" },
        { id: "wallet-2", projectId: "test-project-id" },
      ];
      const mockResponse = {
        data: mockWallets,
        pagination: { page: 1, pageSize: 10, totalCount: 2, totalPages: 1 },
      };
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.getProjectWallets();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "api/project-wallet/test-project-id?page=1",
      );
      expect(result.data).toEqual(mockWallets);
      expect(result.pagination.totalCount).toBe(2);
    });

    it("fetches specific page", async () => {
      const mockResponse = {
        data: [{ id: "wallet-3", projectId: "test-project-id" }],
        pagination: { page: 2, pageSize: 10, totalCount: 4, totalPages: 2 },
      };
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.getProjectWallets({ page: 2 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "api/project-wallet/test-project-id?page=2",
      );
      expect(result.pagination.page).toBe(2);
    });

    it("returns empty array when no wallets", async () => {
      const mockResponse = {
        data: [],
        pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 0 },
      };
      mockAxiosInstance.get.mockResolvedValue({ status: 200, data: mockResponse });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      const result = await wallet.getProjectWallets();

      expect(result.data).toEqual([]);
      expect(result.pagination.totalCount).toBe(0);
    });

    it("throws if API call fails", async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 500 });
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      await expect(wallet.getProjectWallets()).rejects.toThrow(
        "Failed to get project wallets",
      );
    });
  });

  describe("getAllProjectWallets", () => {
    it("fetches all wallets across pages", async () => {
      const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

      // First page
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          data: [{ id: "wallet-1" }, { id: "wallet-2" }, { id: "wallet-3" }],
          pagination: { page: 1, pageSize: 10, totalCount: 5, totalPages: 2 },
        },
      });
      // Second page
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          data: [{ id: "wallet-4" }, { id: "wallet-5" }],
          pagination: { page: 2, pageSize: 10, totalCount: 5, totalPages: 2 },
        },
      });

      const result = await wallet.getAllProjectWallets();

      expect(result).toHaveLength(5);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });
});

describe("WalletDeveloperControlled error scenarios", () => {
  let mockSdk: Web3Sdk;
  let mockAxiosInstance: { get: jest.Mock; post: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    };

    mockSdk = {
      projectId: "test-project-id",
      apiKey: "test-api-key",
      network: "testnet",
      privateKey: "mock-private-key",
      axiosInstance: mockAxiosInstance,
      getProject: jest.fn().mockResolvedValue({
        id: "test-project-id",
        publicKey: "mock-public-key",
      }),
    } as unknown as Web3Sdk;
  });

  it("handles network errors gracefully", async () => {
    mockAxiosInstance.post.mockRejectedValue(new Error("Network error"));
    const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

    await expect(wallet.createWallet()).rejects.toThrow("Network error");
  });

  it("handles API timeout", async () => {
    mockAxiosInstance.get.mockRejectedValue(new Error("timeout"));
    const wallet = new WalletDeveloperControlled({ sdk: mockSdk });

    await expect(wallet.getProjectWallets()).rejects.toThrow("timeout");
  });
});
