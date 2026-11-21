import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: '127.0.0.1' },
  // Built into the plugin; the plugin server serves it at /premium/ and the user's own converted models at /models/.
  base: '/premium/',
  build: { outDir: '../plugin/ui-premium', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
