import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages のサブパスに合わせる
export default defineConfig({
  base: '/garden-gnome-analytics/',
  plugins: [react()],
  // ルートの public-data/ を静的アセットとしてそのまま配信
  publicDir: resolve(__dirname, '../../public-data'),
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..', '../..'],
    },
  },
  build: {
    sourcemap: true,
  },
});
