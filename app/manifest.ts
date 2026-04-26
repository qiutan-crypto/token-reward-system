import type { MetadataRoute } from 'next'

// PWA manifest — controls how the app appears when added to a phone home screen.
// Next.js serves this at /manifest.webmanifest and links it from <head> automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '金币奖励',
    short_name: '金币奖励',
    description: '孩子的行为奖励系统',
    start_url: '/',
    display: 'standalone',          // hides browser chrome when launched from home screen
    background_color: '#4C1D95',    // splash-screen background (matches app purple)
    theme_color: '#4C1D95',         // status-bar tint on Android
    orientation: 'portrait',
    icons: [
      // The 192px icon is auto-served by Next.js from app/icon.png (path: /icon.png)
      { src: '/icon.png',                  sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png',              sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Maskable: Android adaptive icon — safe-zone padded version of the coin
      { src: '/icon-maskable-512.png',     sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
