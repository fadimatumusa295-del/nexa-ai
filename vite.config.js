import { defineConfig } from 'vite';

// Relative base so the built files load correctly inside the Android WebView.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
  },
});
