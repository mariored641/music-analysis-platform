/**
 * MAP Renderer Visual Capture — Playwright spec
 *
 * For each test case:
 *   1. Navigate to /renderer-test?case=<id>&capture=1
 *   2. Wait for [data-ready="true"] (set after document.fonts.ready)
 *   3. Measure the rendered SVG height
 *   4. Resize viewport to fit exactly
 *   5. Screenshot → renderer-tests/current/<id>.png
 *
 * Run: npx playwright test renderer-tests/capture.spec.ts
 *      (dev server must be running on port 3002 first)
 */

import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { TEST_CASES } from './test-cases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CURRENT_DIR = path.join(__dirname, 'current')

// Ensure output directory exists
if (!fs.existsSync(CURRENT_DIR)) {
  fs.mkdirSync(CURRENT_DIR, { recursive: true })
}

for (const tc of TEST_CASES) {
  test(`capture: ${tc.id} — ${tc.title}`, async ({ page }) => {
    // Navigate to capture mode
    await page.goto(`/renderer-test?case=${tc.id}&capture=1`)

    // Wait for renderer to finish + fonts to load
    // The component sets data-ready="true" after document.fonts.ready
    await page.waitForSelector('[data-ready="true"]', { timeout: 15_000 })

    // Measure actual SVG dimensions
    const svgEl = page.locator('svg').first()
    await expect(svgEl).toBeVisible()

    const bbox = await svgEl.boundingBox()
    if (!bbox) throw new Error(`No bounding box for SVG in test ${tc.id}`)

    // Resize viewport to exactly fit the rendered score (no whitespace crop issues)
    const padding = 0
    await page.setViewportSize({
      width: Math.ceil(bbox.width) + padding,
      height: Math.ceil(bbox.height) + padding,
    })

    // Small wait for any layout reflow after resize
    await page.waitForTimeout(100)

    // Take screenshot of just the SVG element
    const outPath = path.join(CURRENT_DIR, `${tc.id}.png`)
    await svgEl.screenshot({
      path: outPath,
      type: 'png',
    })

    console.log(`✓ ${tc.id}: ${Math.ceil(bbox.width)}×${Math.ceil(bbox.height)}px → ${outPath}`)
  })
}
