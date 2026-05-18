import type { MetadataRoute } from 'next';

/**
 * Web App Manifest — makes the dashboard installable on Android home
 * screens and improves how it shows up in browser UI.
 *
 * iOS uses the apple-icon.png in app/ instead (Apple ignores manifests).
 * Modern desktop browsers will read the SVG icon via app/icon.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IshVenom — Snakebite Surveillance',
    short_name: 'IshVenom',
    description:
      'Real-time snakebite incident dashboard for WHO and public health officers.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080C12',
    theme_color: '#0EA5E9',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
