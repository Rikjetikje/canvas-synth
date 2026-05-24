import { defineConfig } from 'vite'

// Repo name → public asset path on GitHub Pages
// (project URL becomes https://<user>.github.io/canvas-synth/)
export default defineConfig({
  base: '/canvas-synth/',
  server: {
    port: 5173,
  },
})
