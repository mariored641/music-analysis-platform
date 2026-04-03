/**
 * MAP Renderer Layer 2 — App Integration Capture
 *
 * Renders the same fixtures as capture.spec.ts (Layer 1) but via the
 * /app-test route, which wraps the SVG in a real `.vrv-svg` div with
 * ScoreView.css applied.
 *
 * Purpose: detect CSS regressions that only appear in the production layout.
 *
 * Diagnostic logic:
 *   Layer 1 pass + Layer 2 fail  → CSS/environment regression
 *   Both fail                    → logic bug in renderer
 *   Both pass                    → WYSIWYG confirmed ✓
 *
 * Output: renderer-tests/current-app/<id>.png
 * Reference: same renderer-tests/reference/<id>.png as Layer 1
 *
 * Run: npx playwright test renderer-tests/app-integration.spec.ts
 *      (dev server must be running on port 3002 first)
 */

import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { TEST_CASES } from './test-cases'

const __dirname   = path.dirname(fileURLToPath(import.meta.url))
const CURRENT_DIR = path.join(__dirname, 'current-app')
const REF_DIR     = path.join(__dirname, 'reference')

if (!fs.existsSync(CURRENT_DIR)) {
  fs.mkdirSync(CURRENT_DIR, { recursive: true })
}

// ─── Layer 2 capture ─────────────────────────────────────────────────────────
for (const tc of TEST_CASES) {
  test(`app-layer2: ${tc.id} — ${tc.title}`, async ({ page }) => {
    // Navigate to /app-test (renders SVG inside .vrv-svg with ScoreView.css)
    await page.goto(`/app-test?case=${tc.id}&capture=1`)

    // Wait for SVG inject + fonts to load (same signal as Layer 1)
    await page.waitForSelector('[data-ready="true"]', { timeout: 20_000 })

    // Locate the SVG inside the .vrv-svg container
    const svgEl = page.locator('[data-testid="app-test-output"] svg').first()
    await expect(svgEl).toBeVisible({ timeout: 10_000 })

    // The SVG has width:100% (from .vrv-svg svg CSS). To compare fairly with
    // Layer 1 (native 2978px), resize viewport to match native page width.
    const svgWidth = await svgEl.evaluate((el: SVGElement) => {
      const vb = el.getAttribute('viewBox')
      if (vb) return parseInt(vb.split(' ')[2], 10)
      return el.getBoundingClientRect().width
    })
    const svgHeight = await svgEl.evaluate((el: SVGElement) => {
      const vb = el.getAttribute('viewBox')
      if (vb) return parseInt(vb.split(' ')[3], 10)
      return el.getBoundingClientRect().height
    })

    // Resize viewport so the SVG renders at native dimensions (width:100% → 2978px)
    await page.setViewportSize({ width: svgWidth, height: svgHeight })
    await page.waitForTimeout(80)  // brief reflow after resize

    // Screenshot the SVG element
    const outPath = path.join(CURRENT_DIR, `${tc.id}.png`)
    await svgEl.screenshot({ path: outPath, type: 'png' })

    console.log(`✓ app-layer2 ${tc.id}: ${svgWidth}×${svgHeight}px → ${outPath}`)

    // Quick sanity: check if a Layer 1 reference exists for cross-comparison
    const refPath = path.join(REF_DIR, `${tc.id}.png`)
    if (!fs.existsSync(refPath)) {
      console.warn(`  ⚠ No Layer 1 reference at ${refPath} — run capture.spec.ts first`)
    }
  })
}
