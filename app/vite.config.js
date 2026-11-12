import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build natijasi to'g'ridan-to'g'ri plugin ichiga tushadi: plugin/ui
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../plugin/ui', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, open: true },
});
