import { UTxO } from "@meshsdk/common";

export type Web3Project = {
  id: string;
  name: string;
  whitelistedUrls: string[];
  isActive: boolean;
  credits: number;
  discordOauthClient: string | null;
  discordOauthSecret: string | null;
  twitterOauthClient: string | null;
  twitterOauthSecret: string | null;
  googleOauthClient: string | null;
  googleOauthSecret: string | null;
  branding: Web3ProjectBranding;
  publicKey: string | null;
  apiKey: string;
};

export type Web3ProjectBranding = {
  name?: string;
  color?: string;
  logoUrl?: string;
  twitterEnabled?: boolean;
  discordEnabled?: boolean;
  googleEnabled?: boolean;
  appleEnabled?: boolean;
  emailEnabled?: boolean;
};

export type Web3ProjectWallet = {
  id: string;
  projectId: string;
  key: string;
  pubKeyHash: string;
  stakeCredentialHash: string;
  tags: string[];
};

export type Web3JWTBody = {
  /** User's ID */
  sub: string;
  /** Can contain: 'projectId' or 'dashboard'. */
  scopes: string[];
  /** Issued at */
  iat: number;
  /** Expires at */
  exp: number;
  /** OAuth2 Provider */
  provider: string;
  /** User ID on OAuth2 Provider */
  providerId: string;
  /** Profile picture from OAuth2 Provider */
  avatarUrl: string | null;
  /** Email from OAuth2 Provider */
  email: string | null;
  /** Username from OAuth2 Provider */
  username: string | null;
};

export type Web3AuthProvider = "google" | "discord" | "twitter" | "apple" | "email";

/** Role a user can have within a project */
export type Web3ProjectRole = "owner" | "admin" | "developer" | "billing";

/** Status of a project invitation */
export type Web3InvitationStatus = "pending" | "accepted" | "revoked";

/** A project invitation (invite link) */
export type Web3ProjectInvitation = {
  id: string;
  projectId: string;
  token: string;
  role: Web3ProjectRole;
  status: Web3InvitationStatus;
  expiresAt: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
};

/** Public info shown to someone viewing an invite link before accepting */
export type Web3InvitationInfo = {
  id: string;
  role: Web3ProjectRole;
  projectName: string;
  projectId: string;
};

/** A project member with user details */
export type Web3ProjectMember = {
  userId: string;
  role: Web3ProjectRole;
  createdAt: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type SponsorshipTxParserPostRequestBody = {
  txHex: string;
  utxos: string;
  address: string;
  sponsorUtxo: string;
  network: "mainnet" | "testnet";
};

export * from "./multi-chain";
