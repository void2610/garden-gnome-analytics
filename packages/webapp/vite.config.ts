import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages のサブパスに合わせる
export default defineConfig({
  base: '/garden-gnome-analytics/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..', '../..'],
    },
  },
});
