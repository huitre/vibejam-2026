import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:2567',
        changeOrigin: true,
      },
    },
  },
});
