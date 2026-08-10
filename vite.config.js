import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/nsescanner/',
  plugins: [react()],
  server: {
    proxy: {
      '/yf-api': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yf-api/, '')
      }
    }
  }
})
