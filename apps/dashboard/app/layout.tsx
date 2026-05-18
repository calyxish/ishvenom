import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'IshVenom — Snakebite Surveillance Dashboard',
  description:
    'Real-time snakebite incident data for WHO and public health officers.',
  // Next.js App Router auto-detects app/icon.svg + app/apple-icon.png and
  // serves them, but we declare them explicitly so older browsers also
  // pick up the favicon.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
  applicationName: 'IshVenom',
  appleWebApp: {
    capable: true,
    title: 'IshVenom',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  // Match the active theme — Safari / Chrome use this to tint the OS UI
  // (mobile address bar, status bar). The values follow the design system:
  // light bg-primary (#F8FAFC) and dark bg-primary (#080C12).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)',  color: '#080C12' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required by next-themes because the
    // `class` and `style` attributes on <html> get rewritten on the client
    // before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <body className="bg-ish-bg text-ish-text min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
