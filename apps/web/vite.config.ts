import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import rootPkg from '../../package.json' with { type: 'json' };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? rootPkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg', 'theme-init.js'],
      manifest: {
        name: 'Fuel Tracker',
        short_name: 'Fuel',
        description: 'Track fill-ups, costs and service reminders for the family cars.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f1f3f8',
        theme_color: '#f1f3f8',
        categories: ['utilities', 'finance', 'travel'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [{ name: 'Log a fill-up', short_name: 'Fill-up', url: '/?add=fillup' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: ['splash/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Receipt photos already viewed stay available offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/photos/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'receipt-photos',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/splash/'),
            handler: 'CacheFirst',
            options: { cacheName: 'splash', expiration: { maxEntries: 60 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    // Keep the browser's Host and add X-Forwarded-* so the API's same-origin check sees the
    // address you opened, not localhost:3000.
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false, xfwd: true } },
  },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
});
