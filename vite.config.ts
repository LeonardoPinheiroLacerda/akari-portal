import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Em dev, /v1 é repassado ao backend Quarkus (sobrescreva com AKARI_API_URL).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.AKARI_API_URL ?? 'http://localhost:8080'
  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5173,
      proxy: {
        '/v1': {
          target,
          changeOrigin: true,
          configure: (proxy) => {
            // O Node só envia os headers no primeiro byte do corpo; um stream SSE sem eventos
            // ficaria "pendurado" e o EventSource nunca abriria. Força o envio dos headers.
            proxy.on('proxyRes', (proxyRes, _req, res) => {
              if (String(proxyRes.headers['content-type'] ?? '').startsWith('text/event-stream')) {
                process.nextTick(() => res.flushHeaders())
              }
            })
          },
        },
      },
    },
  }
})
