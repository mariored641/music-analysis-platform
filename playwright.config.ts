import { defineConfig, devices } from '@playwright/test'

/**
 * MAP Renderer Visual Test — Playwright Config
 *
 * Runs screenshot capture tests against the dev server at localhost:3002.
 * Screenshots saved to renderer-tests/current/*.png
 * Reference images in renderer-tests/reference/*.png
 *
 * Usage:
 *   npm run test:r:capture   → capture current screenshots
 *   npm run test:r:compare   → compare current vs reference (generates report)
 *   npm run test:r:update    → promote current → reference
 */

export default defineConfig({
  testDir: './renderer-tests',
  testMatch: '*.spec.ts',

  // No parallelism — render order doesn't matter but avoids port conflicts
  workers: 1,
  retries: 0,

  // Fail fast in CI, but let all run locally
  maxFailures: process.env.CI ? 1 : 0,

  use: {
    baseURL: 'http://localhost:3002',

    // Full-page screenshots, white background
    screenshot: 'only-on-failure',

    // Wait for network to be idle before proceeding
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Fixed viewport so screenshots are deterministic
        viewport: { width: 900, height: 1200 },
        // deviceScaleFactor: 1 matches the reference generation (generate-refs-playwright.ts)
        deviceScaleFactor: 1,
      },
    },
  ],

  // Output dir for trace/videos (not used normally)
  outputDir: 'renderer-tests/playwright-output',

  // We run the dev server ourselves before calling playwright
  // (see npm scripts in package.json)
  webServer: undefined,
})
