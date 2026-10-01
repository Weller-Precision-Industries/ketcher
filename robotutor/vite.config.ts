import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds the harness against the fork's workspace packages, resolved through the
// fork root node_modules exactly as a consumer bundle resolves the npm release.
export default defineConfig({
  root: 'harness',
  base: './',
  plugins: [react()],
  define: {
    // The npm util polyfill behind ketcher-core's `assert` reads this at load.
    'process.env.NODE_DEBUG': 'undefined',
  },
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    outDir: '../.harness-dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 20_000,
  },
  logLevel: 'warn',
});
