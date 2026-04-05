/**
 * MAP Renderer — PNG Comparison Script
 *
 * Compares renderer-tests/current/*.png against renderer-tests/reference/*.png
 * using pixelmatch (same approach as webmscore vtest-compare-pngs.sh).
 *
 * For each test case:
 *   - If reference doesn't exist → status: 'new' (needs approval)
 *   - If current doesn't exist  → status: 'missing'
 *   - Otherwise                 → pixelmatch diff → status: 'pass' | 'fail'
 *
 * Outputs:
 *   renderer-tests/diff/<id>.diff.png    — pixel diff overlay
 *   renderer-tests/compare-result.json   — machine-readable summary
 *
 * Run: npx tsx renderer-tests/scripts/compare.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { TEST_CASES } from '../test-cases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pixelmatch = require('pixelmatch')
const { PNG } = require('pngjs')

const ROOT     = path.join(__dirname, '..')
const REF_DIR  = path.join(ROOT, 'reference')
const CUR_DIR  = path.join(ROOT, 'current')
const DIFF_DIR = path.join(ROOT, 'diff')

fs.mkdirSync(DIFF_DIR, { recursive: true })

// Title band cutoff — pixels with y < this are title region, y >= this are content
// Based on observed title band in diff images (title text at y=214-295, generous margin)
const TITLE_CUTOFF_Y = 350

export interface CompareResult {
  id:           string
  title:        string
  status:       'pass' | 'fail' | 'new' | 'missing'
  diffPixels:   number | null
  totalPixels:  number | null
  matchPct:     number | null   // 0–100, null if no comparison possible
  // Region-aware diff breakdown
  titleDiffPx:   number | null  // diff pixels in title band (y < TITLE_CUTOFF_Y)
  contentDiffPx: number | null  // diff pixels in content band (y >= TITLE_CUTOFF_Y)
  refPath:      string | null
  curPath:      string | null
  diffPath:     string | null
  // Dimension info — null when image not available
  refWidth:     number | null
  refHeight:    number | null
  curWidth:     number | null
  curHeight:    number | null
  sizeMismatch: boolean        // true when ref and cur dimensions differ
}

function readPng(filePath: string): InstanceType<typeof PNG> | null {
  if (!fs.existsSync(filePath)) return null
  const buf = fs.readFileSync(filePath)
  return PNG.sync.read(buf)
}

function comparePngs(
  ref: InstanceType<typeof PNG>,
  cur: InstanceType<typeof PNG>,
  outPath: string,
): { diffPixels: number; totalPixels: number } {
  // If dimensions differ, create a canvas large enough for both
  const w = Math.max(ref.width, cur.width)
  const h = Math.max(ref.height, cur.height)

  // Pad images to same size (fill extra with white)
  function padImage(img: InstanceType<typeof PNG>): Buffer {
    const out = Buffer.alloc(w * h * 4, 255) // white
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const src = (y * img.width + x) * 4
        const dst = (y * w + x) * 4
        out[dst]     = img.data[src]
        out[dst + 1] = img.data[src + 1]
        out[dst + 2] = img.data[src + 2]
        out[dst + 3] = img.data[src + 3]
      }
    }
    return out
  }

  const refData = ref.width === w && ref.height === h ? ref.data : padImage(ref)
  const curData = cur.width === w && cur.height === h ? cur.data : padImage(cur)
  const diffData = Buffer.alloc(w * h * 4)

  const diffPixels = pixelmatch(refData, curData, diffData, w, h, {
    threshold: 0.1,       // 0 = exact, 1 = anything matches
    includeAA: false,     // ignore anti-aliasing differences
    diffColor: [255, 0, 0],   // red diff pixels
    diffColorAlt: [0, 255, 0], // green for dimmed matches (not used here)
  })

  // Count diff pixels by region (title vs content)
  // pixelmatch uses diffColor (255,0,0) for positive delta and diffColorAlt (0,255,0) for negative delta
  // Both are counted in the returned diffPixels — scan for both
  let titleDiffPx = 0
  let contentDiffPx = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const r = diffData[idx], g = diffData[idx + 1], b = diffData[idx + 2]
      const isDiff = (r === 255 && g === 0 && b === 0) ||  // diffColor (red)
                     (r === 0 && g === 255 && b === 0)      // diffColorAlt (green)
      if (isDiff) {
        if (y < TITLE_CUTOFF_Y) {
          titleDiffPx++
        } else {
          contentDiffPx++
        }
      }
    }
  }

  // Write diff PNG
  const diffPng = new PNG({ width: w, height: h })
  diffData.copy(diffPng.data)
  fs.writeFileSync(outPath, PNG.sync.write(diffPng))

  return { diffPixels, totalPixels: w * h, titleDiffPx, contentDiffPx }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const results: CompareResult[] = []
let passCount = 0
let failCount = 0
let newCount  = 0
let missingCount    = 0
let sizeMismatchCount = 0

console.log('\n🔍 MAP Renderer — PNG Comparison\n')
console.log(`  Reference dir : ${REF_DIR}`)
console.log(`  Current dir   : ${CUR_DIR}`)
console.log(`  Diff dir      : ${DIFF_DIR}`)
console.log('')

for (const tc of TEST_CASES) {
  const refPath  = path.join(REF_DIR, `${tc.id}.png`)
  const curPath  = path.join(CUR_DIR, `${tc.id}.png`)
  const diffPath = path.join(DIFF_DIR, `${tc.id}.diff.png`)

  const refPng = readPng(refPath)
  const curPng = readPng(curPath)

  let result: CompareResult

  if (!curPng) {
    result = { id: tc.id, title: tc.title, status: 'missing',
      diffPixels: null, totalPixels: null, matchPct: null,
      titleDiffPx: null, contentDiffPx: null,
      refPath: refPng ? refPath : null, curPath: null, diffPath: null,
      refWidth: refPng?.width ?? null, refHeight: refPng?.height ?? null,
      curWidth: null, curHeight: null, sizeMismatch: false }
    missingCount++
    console.log(`  ⬜ MISSING  ${tc.id}`)
  } else if (!refPng) {
    result = { id: tc.id, title: tc.title, status: 'new',
      diffPixels: null, totalPixels: null, matchPct: null,
      titleDiffPx: null, contentDiffPx: null,
      refPath: null, curPath, diffPath: null,
      refWidth: null, refHeight: null,
      curWidth: curPng.width, curHeight: curPng.height, sizeMismatch: false }
    newCount++
    console.log(`  🆕 NEW      ${tc.id}  (run update-refs to approve)`)
  } else {
    const sizeMismatch = refPng.width !== curPng.width || refPng.height !== curPng.height
    const { diffPixels, totalPixels, titleDiffPx, contentDiffPx } = comparePngs(refPng, curPng, diffPath)
    const matchPct = Math.round((1 - diffPixels / totalPixels) * 1000) / 10
    const status   = diffPixels === 0 ? 'pass' : 'fail'
    result = { id: tc.id, title: tc.title, status,
      diffPixels, totalPixels, matchPct,
      titleDiffPx, contentDiffPx,
      refPath, curPath, diffPath: diffPixels > 0 ? diffPath : null,
      refWidth: refPng.width, refHeight: refPng.height,
      curWidth: curPng.width, curHeight: curPng.height, sizeMismatch }
    if (sizeMismatch) {
      sizeMismatchCount++
      console.log(`  ⚠  SIZE     ${tc.id}  ref=${refPng.width}×${refPng.height}  cur=${curPng.width}×${curPng.height}`)
    }
    if (status === 'pass') {
      passCount++
      console.log(`  ✅ PASS     ${tc.id}  (100% match)`)
    } else {
      failCount++
      console.log(`  ❌ FAIL     ${tc.id}  ${matchPct}% match — ${diffPixels.toLocaleString()} px differ  [title: ${titleDiffPx.toLocaleString()} | content: ${contentDiffPx.toLocaleString()}]`)
    }
  }

  results.push(result)
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('')
console.log('─'.repeat(50))
console.log(`  ✅ Pass    : ${passCount}`)
console.log(`  ❌ Fail    : ${failCount}`)
console.log(`  🆕 New     : ${newCount}`)
console.log(`  ⬜ Missing : ${missingCount}`)
if (sizeMismatchCount > 0) {
  console.log(`  ⚠  Size ≠  : ${sizeMismatchCount}  (layout artifact — fix page dimensions)`)
}
console.log('─'.repeat(50))
console.log('')

if (failCount > 0) {
  console.log('  Run `npm run test:r:report` to open the HTML diff report.')
  console.log('')
}

// ─── Write JSON result ────────────────────────────────────────────────────────

const jsonPath = path.join(ROOT, 'compare-result.json')
fs.writeFileSync(jsonPath, JSON.stringify({ results, summary: {
  total: TEST_CASES.length, passCount, failCount, newCount, missingCount,
  sizeMismatchCount, timestamp: new Date().toISOString(),
}}, null, 2))
console.log(`  Results written to: ${jsonPath}`)

process.exit(failCount > 0 ? 1 : 0)
