import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Web3Wallet } from "@utxos/sdk";
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

const UTXOS_CONFIG = {
  networkId: Number(process.env.EXPO_PUBLIC_UTXOS_NETWORK_ID) || 0,
  projectId: process.env.EXPO_PUBLIC_UTXOS_PROJECT_ID || "",
};

export default function App() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState<Web3AuthProvider | "any" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (provider?: Web3AuthProvider) => {
    setLoading(provider || "any");
    setError(null);

    try {
      const options: EnableWeb3WalletOptions = {
        networkId: UTXOS_CONFIG.networkId as 0 | 1,
        projectId: UTXOS_CONFIG.projectId,
        directTo: provider,

        appUrl: 'http://localhost:3000',
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

  const handleDisconnect = () => {
    setWallet(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>UTXOS Wallet</Text>
          <Text style={styles.subtitle}>Web3 Wallet as a Service</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!wallet ? (
          <View style={styles.loginSection}>
            {/* Primary Connect Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleConnect()}
              disabled={loading !== null}
            >
              {loading === "any" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Connect Wallet</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Grid */}
            <View style={styles.socialGrid}>
              {PROVIDERS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.socialButton}
                  onPress={() => handleConnect(p.id)}
                  disabled={loading !== null}
                >
                  <Text style={styles.socialIcon}>{p.icon}</Text>
                  <Text style={styles.socialButtonText}>{p.label}</Text>
                  {loading === p.id && (
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                      style={styles.spinner}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.walletSection}>
            {/* User Card */}
            {wallet.user && (
              <View style={styles.userCard}>
                {wallet.user.avatarUrl && (
                  <Image
                    source={{ uri: wallet.user.avatarUrl }}
                    style={styles.avatar}
                  />
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {wallet.user.username || wallet.user.email || "User"}
                  </Text>
                  <Text style={styles.userId}>
                    ID: {wallet.user.id.slice(0, 8)}...
                  </Text>
                </View>
              </View>
            )}

            {/* Address Cards */}
            <View style={styles.addressList}>
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
            </View>

            {/* Disconnect Button */}
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Network: {UTXOS_CONFIG.networkId === 1 ? "Mainnet" : "Preprod"}
        </Text>
      </View>
    </SafeAreaView>
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

  const handleCopy = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return "Not available";
    return `${addr.slice(0, 20)}...${addr.slice(-8)}`;
  };

  return (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={[styles.chainBadge, { backgroundColor: color }]}>
          <Text style={styles.chainBadgeText}>{chain}</Text>
        </View>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Text style={styles.copyButtonText}>
            {copied ? "Copied!" : "Copy"}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.addressText}>{truncateAddress(address)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f1a",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    textAlign: "center",
  },
  loginSection: {
    gap: 16,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dividerText: {
    color: "#6b7280",
    paddingHorizontal: 16,
    fontSize: 12,
  },
  socialGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  socialButton: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  socialIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#e5e7eb",
  },
  spinner: {
    marginLeft: 8,
  },
  walletSection: {
    gap: 20,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  userId: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  addressList: {
    gap: 12,
  },
  addressCard: {
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chainBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  chainBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  copyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  addressText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#9ca3af",
  },
  disconnectButton: {
    width: "100%",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: 10,
    alignItems: "center",
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#f87171",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#4b5563",
    marginTop: "auto",
    paddingBottom: 20,
  },
});
