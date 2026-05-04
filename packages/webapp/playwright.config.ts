import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/garden-gnome-analytics/',
    headless: true,
  },
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: 'http://localhost:5173/garden-gnome-analytics/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
