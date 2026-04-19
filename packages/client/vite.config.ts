import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    port: 5173,
    host: 'localhost',
    https: {},
    allowedHosts: true, 
    cors: true,
    headers: {
        'Content-Security-Policy': "frame-ancestors *",
        'Access-Control-Allow-Origin': '*'
    },
    proxy: {
      '/api-ws': {
         target: 'http://127.0.0.1:2567',
         changeOrigin: true,
         ws: true,
         rewrite: (path) => path.replace(/^\/api-ws/, '')
      },
      '/matchmake': {
         target: 'http://127.0.0.1:2567',
         changeOrigin: true
      },
      '/colyseus': {
         target: 'http://127.0.0.1:2567',
         changeOrigin: true
      },
      '/api': {
         target: 'http://127.0.0.1:2567',
         changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:2567',
        ws: true
      }
    }
  }
})
