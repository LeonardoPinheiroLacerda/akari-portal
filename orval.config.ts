import { defineConfig } from 'orval'

// Contrato servido pelo backend (o mesmo do proxy do Vite; sobrescreva com AKARI_API_URL).
const api = process.env.AKARI_API_URL ?? 'http://localhost:8080'

export default defineConfig({
  akari: {
    input: { target: `${api}/q/openapi` },
    output: {
      mode: 'tags-split',
      target: './src/api/generated/endpoints',
      schemas: './src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/api/http.ts', name: 'http' },
        query: { signal: true },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
})
