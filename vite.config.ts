import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any static host sub-path (e.g. GitHub Pages).
  base: './',
  build: {
    // MapLibre alone is ~1 MB; splitting it gains nothing for a single-page tool.
    chunkSizeWarningLimit: 1500,
  },
});
