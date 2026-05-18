import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IshVenom — Snakebite Surveillance Dashboard',
  description: 'Real-time snakebite incident data for WHO and public health officers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ish-bg text-ish-text min-h-screen">{children}</body>
    </html>
  );
}
