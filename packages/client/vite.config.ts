import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/colyseus': {
         target: 'http://localhost:2567',
         changeOrigin: true
      },
      '/api': {
         target: 'http://localhost:2567',
         changeOrigin: true
      }
    }
  }
})
