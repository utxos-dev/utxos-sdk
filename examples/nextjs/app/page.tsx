"use client";

import { useState } from "react";
import type { EnableWeb3WalletOptions, Web3AuthProvider } from "@utxos/sdk";

type UserData = {
  avatarUrl: string | null;
  email: string | null;
  id: string;
  username: string | null;
};

type WalletState = {
  user: UserData | undefined;
  cardanoAddress: string;
  bitcoinAddress: string;
  sparkAddress: string;
};

const PROVIDERS: { id: Web3AuthProvider; label: string; icon: string }[] = [
  { id: "google", label: "Google", icon: "G" },
  { id: "discord", label: "Discord", icon: "D" },
  { id: "twitter", label: "Twitter", icon: "X" },
  { id: "apple", label: "Apple", icon: "" },
  { id: "email", label: "Email", icon: "@" },
];

export default function Home() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState<Web3AuthProvider | "any" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (provider?: Web3AuthProvider) => {
    setLoading(provider || "any");
    setError(null);

    try {
      const { Web3Wallet } = await import("@utxos/sdk");

      const options: EnableWeb3WalletOptions = {
        networkId: parseInt(process.env.NEXT_PUBLIC_NETWORK_ID || "0") as 0 | 1,
        projectId: process.env.NEXT_PUBLIC_UTXOS_PROJECT_ID || "",
        directTo: provider,
      };

      const web3Wallet = await Web3Wallet.enable(options);

      const user = web3Wallet.getUser();

      const cardanoAddress =
        (await web3Wallet.cardano.getChangeAddressBech32()) || "";
      const bitcoinAddresses = await web3Wallet.bitcoin.getAddresses();
      const bitcoinAddress = bitcoinAddresses[0]?.address || "";
      const sparkAddressInfo = web3Wallet.spark.getAddress();
      const sparkAddress = sparkAddressInfo.address || "";

      setWallet({
        user,
        cardanoAddress,
        bitcoinAddress,
        sparkAddress,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async () => {
    setWallet(null);
  };

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>UTXOS Wallet</h1>
          <p style={styles.subtitle}>Web3 Wallet as a Service</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {!wallet ? (
          <div style={styles.loginSection}>
            <button
              onClick={() => handleConnect()}
              disabled={loading !== null}
              style={styles.primaryButton}
            >
              {loading === "any" ? "Connecting..." : "Connect Wallet"}
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerText}>or continue with</span>
            </div>

            <div style={styles.socialGrid}>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleConnect(p.id)}
                  disabled={loading !== null}
                  style={styles.socialButton}
                >
                  <span style={styles.socialIcon}>{p.icon}</span>
                  <span>{p.label}</span>
                  {loading === p.id && <span style={styles.spinner} />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.walletSection}>
            {wallet.user && (
              <div style={styles.userCard}>
                {wallet.user.avatarUrl && (
                  <img
                    src={wallet.user.avatarUrl}
                    alt="Avatar"
                    style={styles.avatar}
                  />
                )}
                <div>
                  <div style={styles.userName}>
                    {wallet.user.username || wallet.user.email || "User"}
                  </div>
                  <div style={styles.userId}>
                    ID: {wallet.user.id.slice(0, 8)}...
                  </div>
                </div>
              </div>
            )}

            <div style={styles.addressList}>
              <AddressCard
                chain="Cardano"
                address={wallet.cardanoAddress}
                color="#0033AD"
              />
              <AddressCard
                chain="Bitcoin"
                address={wallet.bitcoinAddress}
                color="#F7931A"
              />
              <AddressCard
                chain="Spark"
                address={wallet.sparkAddress}
                color="#8B5CF6"
              />
            </div>

            <button onClick={handleDisconnect} style={styles.disconnectButton}>
              Disconnect
            </button>
          </div>
        )}

        <p style={styles.footer}>
          Network:{" "}
          {process.env.NEXT_PUBLIC_NETWORK_ID === "1" ? "Mainnet" : "Preprod"}
        </p>
      </div>
    </main>
  );
}

function AddressCard({
  chain,
  address,
  color,
}: {
  chain: string;
  address: string;
  color: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={styles.addressCard}>
      <div style={styles.addressHeader}>
        <span style={{ ...styles.chainBadge, backgroundColor: color }}>
          {chain}
        </span>
        <button onClick={handleCopy} style={styles.copyButton}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div style={styles.address}>
        {address
          ? `${address.slice(0, 20)}...${address.slice(-8)}`
          : "Not available"}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
    padding: "1rem",
  },
  container: {
    width: "100%",
    maxWidth: "420px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "24px",
    padding: "2rem",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  header: {
    textAlign: "center",
    marginBottom: "2rem",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: "0.875rem",
    color: "#6b7280",
    margin: "0.5rem 0 0",
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    padding: "0.75rem 1rem",
    borderRadius: "12px",
    marginBottom: "1rem",
    fontSize: "0.875rem",
  },
  loginSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  primaryButton: {
    width: "100%",
    padding: "0.875rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    margin: "0.5rem 0",
  },
  dividerText: {
    flex: 1,
    textAlign: "center",
    fontSize: "0.75rem",
    color: "#6b7280",
    position: "relative",
  },
  socialGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.75rem",
  },
  socialButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#e5e7eb",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    cursor: "pointer",
  },
  socialIcon: {
    fontSize: "1rem",
    fontWeight: 700,
  },
  spinner: {
    width: "12px",
    height: "12px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
  },
  walletSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    objectFit: "cover",
  },
  userName: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
  },
  userId: {
    fontSize: "0.75rem",
    color: "#6b7280",
    marginTop: "0.25rem",
  },
  addressList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  addressCard: {
    padding: "1rem",
    background: "rgba(0,0,0,0.2)",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  addressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  chainBadge: {
    padding: "0.25rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#fff",
  },
  copyButton: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    color: "#9ca3af",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    cursor: "pointer",
  },
  address: {
    fontSize: "0.8rem",
    fontFamily: "monospace",
    color: "#9ca3af",
    wordBreak: "break-all",
  },
  disconnectButton: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#f87171",
    background: "transparent",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: "10px",
    cursor: "pointer",
  },
  footer: {
    textAlign: "center",
    fontSize: "0.75rem",
    color: "#4b5563",
    marginTop: "1.5rem",
    marginBottom: 0,
  },
};
