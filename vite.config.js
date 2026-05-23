import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use relative base so the build works at any GitHub Pages URL
// (both username.github.io/<repo>/ and a custom domain).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true }
})
