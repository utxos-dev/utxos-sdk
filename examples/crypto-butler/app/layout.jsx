// app/layout.jsx
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700'],
});

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
});

const mono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['300', '400', '500'],
});

export const metadata = {
  title: 'Crypto Butler — Your DeFi Wealth Agent',
  description: 'AI-powered DeFi portfolio management. Set your goals, let the Butler work.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-navy-900 text-white font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
