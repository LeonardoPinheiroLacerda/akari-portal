import { defineConfig } from 'orval'

export default defineConfig({
  akari: {
    input: { target: './openapi.yaml' },
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
