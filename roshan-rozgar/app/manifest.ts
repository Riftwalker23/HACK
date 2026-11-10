import type { MetadataRoute } from 'next';

/** Lets the site be added to a phone's home screen and open full-screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Roshan Rozgar',
    short_name: 'Roshan Rozgar',
    description: 'Hyper-local marketplace connecting households with nearby skilled trade workers.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FF9F1C',
    theme_color: '#FF9F1C',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
