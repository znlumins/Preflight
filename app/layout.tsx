import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const instrument = Instrument_Sans({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Mono is reserved for prompt payloads — text that is going into a terminal.
const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Preflight — rencana sebelum ngoding',
  description:
    'Ubah ide jadi PRD, fitur, dan task yang tiap baris tugasnya sudah berupa prompt siap tempel ke AI coding agent. Gratis.',
  // Fallbacks only: routes with their own metadata (`/p/[slug]`, `/docs/*`,
  // `/rencana`) override these per field, so a plan's own title still wins.
  openGraph: {
    type: 'website',
    siteName: 'Preflight',
    locale: 'id_ID',
    title: 'Preflight — rencana sebelum ngoding',
    description:
      'Ubah ide jadi PRD, fitur, dan task yang tiap baris tugasnya sudah berupa prompt siap tempel ke AI coding agent. Gratis.',
  },
  twitter: { card: 'summary_large_image' },
};

// The browser chrome on a phone (Android's address bar, Safari's tab bar tint)
// takes the paper colour instead of a default grey band above the page.
export const viewport: Viewport = {
  themeColor: '#fdfcfa',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="id"
      className={`${instrument.variable} ${jetbrains.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
