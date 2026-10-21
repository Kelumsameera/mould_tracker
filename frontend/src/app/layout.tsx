// Sinhala font bundled with the app (no CDN on the LAN).
import '@fontsource/noto-sans-sinhala/400.css';
import '@fontsource/noto-sans-sinhala/600.css';
import '@fontsource/noto-sans-sinhala/700.css';
import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import PwaProvider from '@/components/PwaProvider';

export const metadata: Metadata = {
  title: 'Mould Tracker', description: 'Find any mould: machine, production floor, workshop or Mould Room rack', manifest: '/manifest.webmanifest',
  applicationName: 'Mould Tracker', appleWebApp: { capable: true, title: 'Mould Tracker', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1B2B35' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><PwaProvider>{children}</PwaProvider></body></html>;
}
