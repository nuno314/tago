import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
