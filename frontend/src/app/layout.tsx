import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'Tool Tracker', description: 'Store & Machine Finder' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
