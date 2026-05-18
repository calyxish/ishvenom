import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'IshVenom — Snakebite Surveillance Dashboard',
  description: 'Real-time snakebite incident data for WHO and public health officers.',
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
