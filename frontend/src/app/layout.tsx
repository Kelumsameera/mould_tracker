import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import PwaProvider from '@/components/PwaProvider';

export const metadata: Metadata = {
  title: 'Tool Tracker', description: 'Store & Machine Finder', manifest: '/manifest.webmanifest',
  applicationName: 'Tool Tracker', appleWebApp: { capable: true, title: 'Tool Tracker', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1B2B35' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><PwaProvider>{children}</PwaProvider></body></html>;
}
