import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // This is where index.html lives
  root: path.resolve(__dirname, 'src/client'),
  plugins: [react()],
  build: {
    // Write the built assets to <project>/dist/client
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true, // clear dist/client before build
  },
});