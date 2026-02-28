'use client';
import { useState, useEffect } from 'react';
import UTXOsWallet from './UTXOsWallet';

export default function WalletConnect({ onConnected }) {
  const [wallets, setWallets] = useState([]);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [tab, setTab] = useState('social'); // 'social' | 'wallet'

  // Detect installed Cardano wallets
  useEffect(() => {
    const detected = [];
    if (typeof window === 'undefined') return;
    const knownWallets = ['eternl', 'nami', 'vespr', 'flint', 'typhon'];
    knownWallets.forEach(name => {
      if (window.cardano?.[name]) {
        detected.push({ 
          name, 
          icon: window.cardano[name].icon, 
          api: window.cardano[name] 
        });
      }
    });
    setWallets(detected);
  }, []);

  // CIP-30 wallet connection (existing logic)
  async function connectWallet(wallet) {
    try {
      const api = await wallet.api.enable();
      const rawAddresses = await api.getUsedAddresses();
      const addr = rawAddresses[0] || 'Connected';
      setAddress(addr.slice(0, 8) + '...' + addr.slice(-4));
      setConnected(true);
      setShowDropdown(false);
      onConnected?.(api, 'cip30');
    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  }

  // Connected state
  if (connected) {
    return (
      <div className="flex items-center gap-2 bg-gold-500/10 border border-gold-500/30 px-3 py-2 rounded-xl">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs text-gold-400 font-mono">{address}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm px-4 py-2 rounded-xl transition-all"
      >
        Connect
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-10 bg-navy-800 border border-gold-500/20 rounded-xl p-3 w-64 z-50 shadow-xl">
          
          {/* Tabs */}
          <div className="flex bg-white/5 rounded-lg p-1 mb-3">
            <button
              onClick={() => setTab('social')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                tab === 'social' 
                  ? 'bg-gold-500 text-navy-900' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Quick Login
            </button>
            <button
              onClick={() => setTab('wallet')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                tab === 'wallet' 
                  ? 'bg-gold-500 text-navy-900' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              My Wallet
            </button>
          </div>

          {/* Social Login Tab */}
          {tab === 'social' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-2">
                No wallet needed — powered by UTXOs.dev
              </p>
              <UTXOsWallet onConnected={(data) => {
                setAddress(data.address.slice(0, 8) + '...' + data.address.slice(-4));
                setConnected(true);
                setShowDropdown(false);
                onConnected?.(data, 'social');
              }} />
            </div>
          )}

          {/* Existing Wallet Tab */}
          {tab === 'wallet' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-2">
                Connect your Cardano wallet
              </p>
              {wallets.length === 0 ? (
                <div className="px-2 py-2">
                  <p className="text-xs text-gray-400 mb-1">No wallet detected.</p>
                  <a
                    href="https://chromewebstore.google.com/detail/eternl/kmhcihpebfmpgmihbkipmjlmmioameka"
                    target="_blank"
                    className="text-xs text-gold-400 hover:underline"
                  >
                    Install Eternl →
                  </a>
                </div>
              ) : (
                wallets.map(w => (
                  <button
                    key={w.name}
                    onClick={() => connectWallet(w)}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {w.icon && (
                      <img src={w.icon} className="w-5 h-5 rounded" alt={w.name} />
                    )}
                    <span className="text-sm text-white capitalize">{w.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
