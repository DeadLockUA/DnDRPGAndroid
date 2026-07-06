import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so production assets need
// that base path. Dev keeps serving from root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/DnDRPGAndroid/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors so the app shell and the Gemini SDK cache
        // independently between deploys.
        manualChunks: {
          genai: ['@google/genai'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
}))
