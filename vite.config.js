import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Leaderboard-React/',  // ← must match your GitHub repo name exactly
  build: {
    outDir: 'dist',
  },
})