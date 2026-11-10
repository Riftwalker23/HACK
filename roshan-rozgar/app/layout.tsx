import type { Metadata, Viewport } from 'next';
import { Noto_Naskh_Arabic, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Cursor from '@/components/cursor';
import { LangProvider } from '@/components/lang';
import Sprite from '@/components/sprite';

/* The three faces the design calls for: Plus Jakarta Sans for Latin UI, Naskh for
   Urdu body text, Nastaliq for Urdu display only (Design.md §3.4). */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});
const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-naskh',
  display: 'swap',
});
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['500', '700'],
  variable: '--font-nastaliq',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Roshan Rozgar',
  description:
    'Hyper-local marketplace for skilled trade workers — a voice-first worker skin and a trust-first customer skin.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FF9F1C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-stage="light"
      className={`${jakarta.variable} ${naskh.variable} ${nastaliq.variable}`}
    >
      <body>
        <LangProvider>
          {/* one sprite for the whole app: icons, trade glyphs, status shapes */}
          <Sprite />
          {children}
          <Cursor />
        </LangProvider>
      </body>
    </html>
  );
}
