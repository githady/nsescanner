import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoBase = '/nsescanner/'

export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : repoBase,
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 8000,
  },
}))