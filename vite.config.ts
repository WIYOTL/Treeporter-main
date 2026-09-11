import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/'

export default defineConfig({
  base,

  plugins: [
    react(),

    VitePWA({
      registerType: 'prompt',

      includeAssets: ['icons/apple-touch-icon.png'],

      manifest: {
        name: 'Treeporter',
        short_name: 'Treeporter',
        description: "Zone de transfert de fichiers depuis l'app Fichiers de l'iPhone vers GitHub",

        theme_color: '#12131A',
        background_color: '#12131A',

        display: 'standalone',
        orientation: 'portrait',

        start_url: base,
        scope: base,

        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}']
      }
    })
  ],

  server: {
    host: true
  }
})