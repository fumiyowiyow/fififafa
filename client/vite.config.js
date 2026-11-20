import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@react-pdf')) return 'react-pdf'
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react'
          if (id.includes('node_modules/axios')) return 'axios'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001', // server hanya mendengar di 127.0.0.1 (app.js)
        changeOrigin: true,
      },
    },
  },
})
