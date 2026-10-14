import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'Tool Tracker', short_name: 'Tool Tracker',
    description: 'Find and manage tools in the store and on machines.',
    start_url: '/', scope: '/', display: 'standalone',
    background_color: '#1B2B35', theme_color: '#1B2B35',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
