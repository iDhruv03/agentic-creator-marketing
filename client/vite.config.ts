import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      // JSON-RPC goes to the backend; browser navigations to /mcp get the SPA.
      '/mcp': { target: 'http://localhost:3001', changeOrigin: true, bypass: (req) => ((req.headers.accept ?? '').includes('text/html') ? '/index.html' : undefined) },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
