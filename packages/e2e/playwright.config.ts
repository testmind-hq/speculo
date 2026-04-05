import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.e2e from repo root if present
dotenv.config({ path: path.resolve(__dirname, '../../.env.e2e') })

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // shared DB — avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // 1. Setup: create auth state files
    {
      name: 'setup',
      testMatch: /setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 2. Anonymous tests (login flow)
    {
      name: 'anon',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // 3. Admin tests
    {
      name: 'admin',
      testMatch: /(?:import|catalog|tokens|admin-users)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // 4. Regular user tests
    {
      name: 'user',
      testMatch: /user-flow\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Start / reuse a local dev server when running locally against localhost.
  // Skipped in CI (servers are started by the workflow) and when pointing at a remote host.
  webServer: (process.env.CI || !BASE_URL.includes('localhost'))
    ? undefined
    : {
        command: 'pnpm --dir ../.. dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
})
