import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4321,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:4320',
      '/assets': 'http://127.0.0.1:4320',
    },
  },
})
