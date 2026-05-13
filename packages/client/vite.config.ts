/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  // Explicitly point envDir to this package so env vars are found regardless
  // of the working directory npm uses when running workspace scripts.
  envDir: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  server: {
    port: 5173,
    host: 'localhost',
    allowedHosts: true,
    cors: true,
    headers: {
      'Content-Security-Policy': 'frame-ancestors *',
      'Access-Control-Allow-Origin': '*',
    },
    proxy: {
      '/api-ws': {
        target: 'http://127.0.0.1:2567',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api-ws/, ''),
      },
      '/matchmake': {
        target: 'http://127.0.0.1:2567',
        changeOrigin: true,
      },
      '/colyseus': {
        target: 'http://127.0.0.1:2567',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:2567',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:2567',
        ws: true,
      },
    },
  },
});
