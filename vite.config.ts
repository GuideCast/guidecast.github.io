import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the user presses "Update", so an open editor is never reloaded by surprise.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: './',
        name: 'GuideCast',
        short_name: 'GuideCast',
        description: 'Step-by-step guides from screenshots',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#0d9488',
        background_color: '#f8fafc',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The 4.6 MB demo guide is not precached: it is cached on first use instead.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        globIgnores: ['demo/**'],
        navigateFallbackDenylist: [/\/demo\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/demo/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'guidecast-demo' },
          },
        ],
      },
    }),
  ],
  base: './', // relative paths for standalone, GitHub Pages, and local viewing
});
