import { defineConfig, devices } from '@playwright/test'

const e2ePort = Number(process.env.E2E_PORT ?? 3000)
const e2eBaseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: e2eBaseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort}`,
    port: e2ePort,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_API_PROXY_TARGET: process.env.E2E_API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
    },
  },
})
