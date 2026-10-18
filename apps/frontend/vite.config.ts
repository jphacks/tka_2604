import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// OGP画像は絶対URLが必要なため、公開先ごとにindex.htmlの%SITE_URL%を置き換える
const siteUrl = process.env.SITE_URL ?? 'https://dev.jphack-2026.workers.dev'

function siteUrlPlugin(): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8787',
    },
  },
  plugins: [
    siteUrlPlugin(),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
