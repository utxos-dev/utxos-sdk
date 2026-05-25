'use client';
import { useState, useEffect, useRef } from 'react';

export default function UTXOsWallet({ onConnected }) {
  const [showIframe, setShowIframe] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const iframeRef = useRef(null);

  const projectId = process.env.NEXT_PUBLIC_UTXOS_PROJECT_ID;
  const iframeUrl = `https://app.utxos.dev/?projectId=${projectId}&chain=cardano&network=preprod`;

  useEffect(() => {
    function handleMessage(event) {
      if (!event.origin.includes('utxos.dev')) return;

      const { type, address, balance } = event.data || {};

      if (type === 'wallet_connected' && address) {
        setAddress(address.slice(0, 8) + '...' + address.slice(-4));
        setConnected(true);
        setShowIframe(false);
        onConnected?.({ address, balance }, 'social');
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConnected]);

  if (connected) {
    return (
      <div className="flex items-center gap-2 bg-gold-500/10 border border-gold-500/30 px-3 py-2 rounded-xl">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs text-gold-400 font-mono">{address}</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowIframe(true)}
        className="bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm px-4 py-2 rounded-xl transition-all"
      >
        Login with Google
      </button>

      {showIframe && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-navy-800 rounded-2xl overflow-hidden shadow-2xl border border-gold-500/20 relative"
               style={{ width: 480, height: 640 }}>
            
            <button
              onClick={() => setShowIframe(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white z-10 text-lg"
            >
              x
            </button>

            <iframe
              ref={iframeRef}
              src={iframeUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="publickey-credentials-get *; publickey-credentials-create *"
              title="UTXOs Wallet"
            />
          </div>
        </div>
      )}
    </>
  );
}
