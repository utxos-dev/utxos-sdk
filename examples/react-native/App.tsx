import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';

// Demo mode - set to false when SDK polyfills are fully working
const DEMO_MODE = true;

// UTXOS Configuration
const UTXOS_CONFIG = {
  networkId: 0, // 0: preprod, 1: mainnet
  projectId: 'demo-project', // Replace with your project ID from https://utxos.dev/dashboard
};

type WalletState = {
  isConnecting: boolean;
  isConnected: boolean;
  address: string | null;
  error: string | null;
};

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({
    isConnecting: false,
    isConnected: false,
    address: null,
    error: null,
  });

  const connectWallet = useCallback(async (provider?: string) => {
    setWallet(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (DEMO_MODE) {
        // Demo mode - simulate wallet connection
        await new Promise(resolve => setTimeout(resolve, 1500));
        const demoAddress = 'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp';

        setWallet({
          isConnecting: false,
          isConnected: true,
          address: demoAddress,
          error: null,
        });

        if (Platform.OS !== 'web') {
          Alert.alert('Demo Mode', `Connected via ${provider || 'wallet'}!\nAddress: ${demoAddress.substring(0, 20)}...`);
        }
        return;
      }

      // Production mode - use actual SDK
      const { Web3Wallet } = await import('@utxos/sdk');
      const web3Wallet = await Web3Wallet.enable({
        ...UTXOS_CONFIG,
      });

      const addresses = await web3Wallet.getUsedAddresses();
      const address = addresses[0] || null;

      setWallet({
        isConnecting: false,
        isConnected: true,
        address,
        error: null,
      });

      if (Platform.OS !== 'web') {
        Alert.alert('Success', `Connected to wallet!\nAddress: ${address?.substring(0, 20)}...`);
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      setWallet(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
      }));
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWallet({
      isConnecting: false,
      isConnected: false,
      address: null,
      error: null,
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>UTXOS</Text>
        </View>
        <Text style={styles.title}>Web3 Wallet</Text>
        <Text style={styles.subtitle}>Wallet as a Service</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {!wallet.isConnected ? (
          <>
            {/* Welcome Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome</Text>
              <Text style={styles.cardText}>
                Connect your wallet using social login or other authentication methods.
              </Text>
            </View>

            {/* Network Badge */}
            <View style={styles.networkBadge}>
              <View style={styles.networkDot} />
              <Text style={styles.networkText}>
                {UTXOS_CONFIG.networkId === 0 ? 'Preprod Network' : 'Mainnet'}
              </Text>
            </View>

            {/* Social Login Buttons */}
            <View style={styles.loginSection}>
              <Text style={styles.sectionTitle}>Sign in with</Text>

              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton]}
                onPress={() => connectWallet('google')}
                disabled={wallet.isConnecting}
              >
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={() => connectWallet('apple')}
                disabled={wallet.isConnecting}
              >
                <Text style={styles.socialIcon}>🍎</Text>
                <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                  Continue with Apple
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, styles.discordButton]}
                onPress={() => connectWallet('discord')}
                disabled={wallet.isConnecting}
              >
                <Text style={styles.socialIcon}>💬</Text>
                <Text style={[styles.socialButtonText, styles.discordButtonText]}>
                  Continue with Discord
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.socialButton, styles.walletButton]}
                onPress={() => connectWallet()}
                disabled={wallet.isConnecting}
              >
                <Text style={styles.socialIcon}>🔗</Text>
                <Text style={styles.socialButtonText}>Connect Wallet</Text>
              </TouchableOpacity>
            </View>

            {/* Loading Indicator */}
            {wallet.isConnecting && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Connecting...</Text>
              </View>
            )}

            {/* Error Message */}
            {wallet.error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{wallet.error}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Connected State */}
            <View style={styles.connectedCard}>
              <View style={styles.successIcon}>
                <Text style={styles.successEmoji}>✅</Text>
              </View>
              <Text style={styles.connectedTitle}>Wallet Connected</Text>
              <Text style={styles.connectedSubtitle}>Your wallet is ready to use</Text>

              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>Address</Text>
                <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
                  {wallet.address || 'No address found'}
                </Text>
              </View>

              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Balance</Text>
                <Text style={styles.balanceText}>Loading...</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionIcon}>📤</Text>
                <Text style={styles.actionButtonText}>Send</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionIcon}>📥</Text>
                <Text style={styles.actionButtonText}>Receive</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionIcon}>📜</Text>
                <Text style={styles.actionButtonText}>History</Text>
              </TouchableOpacity>
            </View>

            {/* Disconnect Button */}
            <TouchableOpacity style={styles.disconnectButton} onPress={disconnectWallet}>
              <Text style={styles.disconnectButtonText}>Disconnect Wallet</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by UTXOS • Wallet as a Service</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  networkText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  loginSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  discordButton: {
    backgroundColor: '#5865F2',
  },
  walletButton: {
    backgroundColor: '#3b82f6',
  },
  socialIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  appleButtonText: {
    color: '#fff',
  },
  discordButtonText: {
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    paddingHorizontal: 16,
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#450a0a',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  connectedCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#14532d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successEmoji: {
    fontSize: 32,
  },
  connectedTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  connectedSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  addressContainer: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  addressLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  balanceContainer: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 90,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
  },
});
