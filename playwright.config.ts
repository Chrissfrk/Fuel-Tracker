import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

/**
 * End-to-end tests run against the production build (`npm run build` first — `npm run e2e` does it),
 * with a throwaway data directory. Tests share one server and run in file order.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Fresh data directory every run.
    command: 'rm -rf .e2e-data && node apps/server/dist/index.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    stderr: 'pipe',
    stdout: process.env.E2E_SERVER_LOGS ? 'pipe' : 'ignore',
    env: {
      PORT: String(PORT),
      DATA_DIR: '.e2e-data',
      SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
      COOKIE_SECURE: 'false',
      TZ: 'Europe/Athens',
      LOG_LEVEL: 'warn',
    },
  },
});
