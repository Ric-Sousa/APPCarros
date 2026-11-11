// Testes ponta a ponta: `npm run test:e2e`. Arranca a app com SQLite em memória numa porta própria.
// Localmente sem Chromium do Playwright: PW_CHANNEL=msedge npm run test:e2e
import { defineConfig } from '@playwright/test';

const port = 5199;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    channel: process.env.PW_CHANNEL || undefined,
    locale: 'pt-PT',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx tsx server/index.ts',
    url: `http://localhost:${port}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'development',
      PORT: String(port),
      DB_CLIENT: 'sqlite',
      DB_FILE: ':memory:',
      JWT_SECRET: 'e2e-secret-com-pelo-menos-32-caracteres-xyz',
      NOTIFICATIONS_ENABLED: 'false',
      APP_URL: `http://localhost:${port}`,
      CORS_ORIGINS: `http://localhost:${port}`,
    },
  },
});
