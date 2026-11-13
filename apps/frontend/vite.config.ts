import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// OGP画像は絶対URLが必要なため、公開先ごとにindex.htmlの%SITE_URL%を置き換える
const siteUrl = process.env.SITE_URL ?? 'https://dev.jphack-2026.workers.dev'
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8787'

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
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest, request) => {
            // The Worker sees its own port. Translate only an exact same-origin
            // request through the local Vite proxy; foreign/null/missing Origin
            // values must reach the backend unchanged and remain rejected.
            const source = `http://${request.headers.host ?? ''}`
            const target = new URL(apiTarget)
            if (
              request.headers.origin === source &&
              /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
                source,
              ) &&
              ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
            ) {
              proxyRequest.setHeader('Origin', target.origin)
            }
          })
        },
      },
    },
  },
  plugins: [
    siteUrlPlugin(),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
