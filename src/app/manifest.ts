import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrandVox Email Automation',
    short_name: 'BrandVox',
    description: 'AI-powered B2B email outreach with human-in-the-loop review',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
