/**
 * MAP Renderer — Generate Reference PNGs via webmscore (Playwright browser)
 *
 * Navigates to /renderer-tests/webmscore-render.html?fixture=...
 * for each test case, waits for webmscore to render, and screenshots the SVG.
 * Saves to renderer-tests/reference/<id>.png
 *
 * Run:
 *   npx tsx renderer-tests/scripts/generate-refs-playwright.ts
 *   npx tsx renderer-tests/scripts/generate-refs-playwright.ts --id=02-accidentals
 *
 * Requires: dev server running on port 3002
 *           npx playwright install chromium (once)
 */

import * as path from 'path'
import * as fs   from 'fs'
import { chromium } from '@playwright/test'
import { TEST_CASES } from '../test-cases.js'

const ROOT    = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))), '..')
const REF_DIR = path.join(ROOT, 'reference')
const BASE    = 'http://localhost:3002'

fs.mkdirSync(REF_DIR, { recursive: true })

const args  = process.argv.slice(2)
const idArg = args.find(a => a.startsWith('--id='))?.slice(5)
const cases = idArg ? TEST_CASES.filter(tc => tc.id === idArg) : TEST_CASES

if (cases.length === 0) {
  console.error(`No test case found with id: ${idArg}`)
  process.exit(1)
}

console.log('\n🎼 Generating reference PNGs via webmscore (Playwright)\n')
console.log(`  Output   : ${REF_DIR}`)
console.log(`  Cases    : ${cases.length}\n`)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  // Large enough to contain a full A4 page at 360 DPI (≈2977×4209px)
  // without triggering any responsive reflow before we resize to the SVG bbox.
  // Must match capture.spec.ts strategy: resize to exact SVG dimensions before screenshot.
  viewport: { width: 2980, height: 4220 },
  deviceScaleFactor: 1,
})
const page    = await context.newPage()

let ok = 0, fail = 0

for (const tc of cases) {
  const url     = `${BASE}/renderer-tests/webmscore-render.html?fixture=${encodeURIComponent(tc.fixtureFile)}`
  const outPath = path.join(REF_DIR, `${tc.id}.png`)

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

    // Wait for webmscore to finish rendering (sets data-ready="true" on <html>)
    await page.waitForSelector('html[data-ready="true"]', { timeout: 30_000 })

    // Screenshot just the SVG element
    const svgEl = page.locator('#output svg').first()
    const bbox  = await svgEl.boundingBox()
    if (!bbox) throw new Error('No SVG bounding box — render may have failed')

    // Resize viewport to match SVG dimensions exactly
    await page.setViewportSize({
      width:  Math.ceil(bbox.width),
      height: Math.ceil(bbox.height),
    })
    await page.waitForTimeout(80)

    await svgEl.screenshot({ path: outPath, type: 'png' })

    const stat = fs.statSync(outPath)
    console.log(`  ✅ ${tc.id}  ${Math.ceil(bbox.width)}×${Math.ceil(bbox.height)}px → ${(stat.size/1024).toFixed(0)} KB`)
    ok++

  } catch (e) {
    // Check if there's an error message on the page
    const errText = await page.locator('#status').textContent().catch(() => '')
    console.error(`  ❌ ${tc.id}  ERROR: ${e}${errText ? `\n     Page: ${errText}` : ''}`)
    fail++
  }
}

await browser.close()

console.log('')
console.log('─'.repeat(50))
console.log(`  Generated : ${ok}`)
console.log(`  Failed    : ${fail}`)
console.log('─'.repeat(50))
console.log('')

if (ok > 0) {
  console.log(`  Reference PNGs in: ${REF_DIR}`)
  console.log('  Open them to verify quality, then run: npm run test:r:capture')
  console.log('')
}

process.exit(fail > 0 ? 1 : 0)
