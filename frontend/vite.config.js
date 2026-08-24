import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
    // El proyecto vive en /mnt/c (WSL): inotify no detecta cambios hechos
    // desde Windows/otros procesos; el polling garantiza el hot reload.
    watch: {
      usePolling: true,
      interval: 800,
    },
  },
})
