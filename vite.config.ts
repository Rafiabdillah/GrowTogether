import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  // Override for sub-path hosting (e.g. VITE_BASE_PATH=/GrowTogether/).
  const base = process.env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // A hand-written worker: push, notification clicks and reminders need
        // listeners the generated worker cannot carry.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        includeAssets: ['favicon.ico', 'icon.svg', 'logo.svg', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'GrowTogether: Habit & Growth Tracker Pasangan',
          short_name: 'GrowTogether',
          description: 'Aplikasi habit & growth tracker untuk dua orang yang berkembang bersama.',
          lang: 'id',
          theme_color: '#FFF9F2',
          background_color: '#FFF9F2',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || process.cwd(), '.'),
      },
    },
    server: {
      // AI Studio sets DISABLE_HMR to stop file watching while the agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
