import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UTXOS Wallet | Web3 Wallet as a Service",
  description: "Connect your wallet with social login - Google, Discord, Twitter, Apple, Email",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
          button:disabled { opacity: 0.5; cursor: not-allowed; }
          button:hover:not(:disabled) { filter: brightness(1.1); }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
