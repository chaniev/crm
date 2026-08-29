import { defineConfig, devices } from '@playwright/test'

const e2ePort = Number(process.env.E2E_PORT ?? 3000)
const e2eBaseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`
const iphoneSafariProfile = devices['iPhone 15 Pro Max']
const safariChromeHeight =
  iphoneSafariProfile.screen.height - iphoneSafariProfile.viewport.height

function targetIphoneProfile(width: number, height: number) {
  return {
    ...iphoneSafariProfile,
    screen: { width, height },
    viewport: {
      width,
      height: height - safariChromeHeight,
    },
  }
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: e2eBaseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /iphone-target-devices\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-air-webkit',
      testMatch: /iphone-target-devices\.spec\.ts/,
      use: targetIphoneProfile(420, 912),
    },
    {
      name: 'iphone-17-pro-max-webkit',
      testMatch: /iphone-target-devices\.spec\.ts/,
      use: targetIphoneProfile(440, 956),
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
