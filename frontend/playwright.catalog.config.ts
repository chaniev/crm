import { defineConfig, devices } from '@playwright/test'

const catalogPort = Number(process.env.CATALOG_E2E_PORT ?? 3021)

export default defineConfig({
  testDir: './e2e/catalog',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{projectName}/{arg}{ext}',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${catalogPort}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'catalog-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'catalog-420',
      use: { ...devices['Desktop Chrome'], viewport: { width: 420, height: 912 } },
    },
    {
      name: 'catalog-440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 440, height: 956 } },
    },
    {
      name: 'catalog-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1200 } },
    },
  ],
  webServer: {
    command: `vite --config vite.catalog.config.ts --host 127.0.0.1 --port ${catalogPort}`,
    port: catalogPort,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
