import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Resolve the library straight from source so the demo runs with no build step.
// This is the demo-only equivalent of installing `light-splide-slide` from npm.
const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^light-splide-slide\/styles\.css$/,
        replacement: fromHere('../../src/styles.css'),
      },
      { find: /^light-splide-slide$/, replacement: fromHere('../../src/index.ts') },
    ],
  },
});
