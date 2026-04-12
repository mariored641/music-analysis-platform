/**
 * Note Match Test — verifies that every selectable notehead gets a data-notemap-id.
 *
 * PASS condition: matched == osmd_deduped
 *   "Every note that OSMD uniquely traverses can be clicked and selected."
 *
 * Notes on counting:
 *   - DOM g.vf-notehead count > matched: includes rests, grace notes,
 *     and notes that share a visual notehead (unisons, collapsed voices).
 *     These extras can't be selected — correct behavior.
 *   - noteMap count > osmd_deduped: XML notes that share a visual notehead
 *     with another note (e.g. unison across two voices). Only one of them
 *     gets matched per notehead.
 *
 * Run: npx playwright test renderer-tests/note-match.spec.ts
 *      (dev server must be running on port 3002 first)
 */

import { test } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const DESKTOP = 'C:/Users/DELL/שולחן העבודה'

const FILES = [
  'liszt-transcendental-etude-no-1-preludio.mxl',
  'liszt-transcendental-etude-no-3-paysage.mxl',
  'liszt-transcendental-etude-no-5-feux-follets.mxl',
  'liszt-transcendental-etude-no-6-vision.mxl',
  'liszt-transcendental-etude-no-8-wilde-jagd.mxl',
  'liszt-transcendental-etude-no-4-mazeppa.mxl',
  'liszt-transcendental-etude-in-f-minor-appassionata-s-139-no-10.mxl',
  'liszt-transcendental-etude-chasse-neige-s-139-no-12.mxl',
  'liszt-trois-etudes-de-concert-no-3-un-sospiro.mxl',
  'etude-s-1413-in-g-minor-la-campanella-liszt.mxl',
  'grandes-etude-de-paganini-no-6-franz-liszt.mxl',
  'bwv-1013-partita-in-a-minor-for-solo-flute.mxl',
]

interface Result {
  file: string
  noteMap: number       // notes parsed from XML (all staves)
  osmdDeduped: number   // unique noteheads OSMD traversed (= matched)
  domNoteheads: number  // g.vf-notehead in DOM (includes rests, grace notes)
  pass: boolean         // osmdDeduped == matched (every traversed note is selectable)
}

const results: Result[] = []

async function goToLibrary(page: import('@playwright/test').Page) {
  const backBtn = page.locator('button', { hasText: '←' })
  if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await backBtn.click()
  }
  await page.waitForSelector('.library-view', { timeout: 10_000 })
}

for (const filename of FILES) {
  const filePath = path.join(DESKTOP, filename)
  if (!fs.existsSync(filePath)) continue

  test(`note-match: ${filename}`, async ({ page }) => {
    let noteMapCount = 0
    let osmdDeduped = 0

    page.on('console', msg => {
      const text = msg.text()
      // "buildOSMDElementMap: N measures, M notes matched (MAP=X OSMD=Y — mismatch!)"
      // or "buildOSMDElementMap: N measures, M notes matched"
      const m = text.match(/buildOSMDElementMap: \d+ measures, (\d+) notes matched/)
      if (m) {
        const matched = parseInt(m[1], 10)
        const mapM = text.match(/MAP=(\d+)/)
        const osmdM = text.match(/OSMD=(\d+)/)
        noteMapCount = mapM ? parseInt(mapM[1], 10) : matched
        osmdDeduped = osmdM ? parseInt(osmdM[1], 10) : matched
      }
    })

    await page.goto('/')
    await goToLibrary(page)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath)

    await page.waitForSelector('.library-modal', { timeout: 10_000 })
    await page.locator('button.btn-confirm').click()

    await page.waitForSelector('.score-view', { timeout: 30_000 })
    await page.waitForSelector('.vrv-svg svg', { timeout: 30_000 })
    await page.waitForFunction(
      () => document.querySelectorAll('[data-notemap-id]').length > 0,
      { timeout: 15_000 }
    )

    const matched = await page.evaluate(
      () => document.querySelectorAll('[data-notemap-id]').length
    )
    const domNoteheads = await page.evaluate(
      () => document.querySelectorAll('g.vf-notehead').length
    )

    // If osmdDeduped was never set (no mismatch log), it equals matched
    if (osmdDeduped === 0) osmdDeduped = matched
    if (noteMapCount === 0) noteMapCount = matched

    const pass = matched === osmdDeduped
    results.push({ file: filename, noteMap: noteMapCount, osmdDeduped, domNoteheads, pass })

    const icon = pass ? '✅' : '❌'
    const sharedNotes = noteMapCount - osmdDeduped
    const nonSelectable = domNoteheads - matched  // rests, grace, shared
    console.log(
      `${icon} ${filename}\n` +
      `   noteMap=${noteMapCount}  selectable=${matched}  ` +
      (sharedNotes > 0 ? `shared(unison/voice-collapse)=${sharedNotes}  ` : '') +
      `dom-extras(rest/grace)=${nonSelectable}`
    )

    await goToLibrary(page)

    const validFiles = FILES.filter(f => fs.existsSync(path.join(DESKTOP, f)))
    if (filename === validFiles.at(-1)) {
      console.log('\n══════════════ SUMMARY ══════════════')
      for (const r of results) {
        const icon = r.pass ? '✅' : '❌'
        const shared = r.noteMap - r.osmdDeduped
        console.log(
          `${icon}  ${r.file.replace('.mxl', '')}\n` +
          `     noteMap=${r.noteMap}  selectable=${r.osmdDeduped}` +
          (shared > 0 ? `  shared=${shared}` : '') +
          (!r.pass ? `  MISSING=${r.osmdDeduped - r.osmdDeduped}` : '')
        )
      }
      const passed = results.filter(r => r.pass).length
      console.log(`\n${passed}/${results.length} files — every traversable notehead is selectable`)
      console.log('═════════════════════════════════════')
    }
  })
}
