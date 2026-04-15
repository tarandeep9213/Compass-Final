import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.E2E_BASE_URL ? `npx vite --port ${new URL(process.env.E2E_BASE_URL).port}` : 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
