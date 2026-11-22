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
      testMatch: /(?:attention-secondary-contrast|client-profile-context-navigation|group-schedule|group-trainer-substitutions|finance-reports|client-full-name-search|settings-client-import|settings-group-types|route-access-feedback|administrator-attendance-scope|administrator-role-flow|administrator-client-branch-access|iphone-target-devices|reduced-motion|attendance-today-worklist|group-schedule-workflow|groups-registry|branch-hall-creation|staff-password-reset(?:-runtime)?)\.spec\.ts/,
      use: targetIphoneProfile(420, 912),
    },
    {
      name: 'iphone-17-pro-max-webkit',
      testMatch: /(?:attention-secondary-contrast|client-profile-context-navigation|group-schedule|group-trainer-substitutions|finance-reports|client-full-name-search|settings-client-import|settings-group-types|route-access-feedback|administrator-attendance-scope|administrator-role-flow|administrator-client-branch-access|iphone-target-devices|reduced-motion|attendance-today-worklist|group-schedule-workflow|groups-registry|branch-hall-creation|staff-password-reset(?:-runtime)?)\.spec\.ts/,
      use: targetIphoneProfile(440, 956),
    },
  ],
  webServer: {
    command: process.argv.some(value => value.includes('settings-client-import.spec.ts'))
      ? 'node e2e/helpers/import-runtime.mjs'
      : process.argv.some(value => value.includes('client-full-name-search.spec.ts'))
        ? 'node e2e/helpers/client-search-runtime.mjs'
      : `npm run dev -- --host 127.0.0.1 --port ${e2ePort}`,
    port: e2ePort,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      E2E_PORT: String(e2ePort),
      VITE_API_PROXY_TARGET: process.env.E2E_API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
    },
  },
})
