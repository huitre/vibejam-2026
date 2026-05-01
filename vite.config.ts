import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public',
  base: '/samuraijam/',
  build: {
    outDir: 'dist/client',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
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
