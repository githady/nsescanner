import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoName = 'nsescanner'

export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : `/${repoName}/`,
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 8000,
  },
}))