/**
 * MAP Renderer — Layer 1 vs Layer 2 Cross-Comparison Script
 *
 * Compares renderer-tests/current/<id>.png (Layer 1: /renderer-test)
 * against renderer-tests/current-app/<id>.png (Layer 2: /app-test)
 *
 * Diagnostic output:
 *   Layer 1 only fails   → logic bug in renderer
 *   Layer 2 only fails   → CSS/environment regression in the app
 *   Both fail            → logic bug (app may amplify it)
 *   Both pass            → WYSIWYG confirmed ✓
 *
 * Also compares both layers against reference (webmscore golden PNGs) to give
 * a complete picture.
 *
 * Run: npx tsx renderer-tests/scripts/compare-layers.ts
 *      (run AFTER both capture.spec.ts and app-integration.spec.ts)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { TEST_CASES } from '../test-cases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)
const pixelmatch = require('pixelmatch')
const { PNG }    = require('pngjs')

const ROOT         = path.join(__dirname, '..')
const REF_DIR      = path.join(ROOT, 'reference')
const L1_DIR       = path.join(ROOT, 'current')
const L2_DIR       = path.join(ROOT, 'current-app')
const DIFF_L2_DIR  = path.join(ROOT, 'diff-layer2')

fs.mkdirSync(DIFF_L2_DIR, { recursive: true })

function readPng(p: string) {
  if (!fs.existsSync(p)) return null
  return PNG.sync.read(fs.readFileSync(p))
}

function matchPct(diff: number, total: number) {
  return total > 0 ? parseFloat(((1 - diff / total) * 100).toFixed(2)) : 100
}

function comparePngs(
  imgA: ReturnType<typeof readPng>,
  imgB: ReturnType<typeof readPng>,
  diffOut: string,
): { diffPixels: number; total: number; sizeMismatch: boolean } {
  if (!imgA || !imgB) return { diffPixels: -1, total: 0, sizeMismatch: false }

  const w = Math.max(imgA.width, imgB.width)
  const h = Math.max(imgA.height, imgB.height)
  const sizeMismatch = imgA.width !== imgB.width || imgA.height !== imgB.height

  // Pad smaller image to canvas size with white
  function padTo(src: ReturnType<typeof readPng>, tw: number, th: number) {
    if (!src) return null
    if (src.width === tw && src.height === th) return src
    const out = new PNG({ width: tw, height: th })
    out.data.fill(255)
    PNG.bitblt(src, out, 0, 0, src.width, src.height, 0, 0)
    return out
  }

  const a = padTo(imgA, w, h)!
  const b = padTo(imgB, w, h)!
  const diff = new PNG({ width: w, height: h })
  const pixels = pixelmatch(a.data, b.data, diff.data, w, h, {
    threshold: 0.1,
    includeAA: false,
  }) as number

  fs.writeFileSync(diffOut, PNG.sync.write(diff))
  return { diffPixels: pixels, total: w * h, sizeMismatch }
}

interface LayerReport {
  id:        string
  title:     string
  // Layer 1 vs reference
  l1VsRef:   { diffPx: number; pct: number; sizeMismatch: boolean } | null
  // Layer 2 vs reference
  l2VsRef:   { diffPx: number; pct: number; sizeMismatch: boolean } | null
  // Layer 1 vs Layer 2 (WYSIWYG check)
  l1VsL2:    { diffPx: number; pct: number; sizeMismatch: boolean } | null
  diagnosis: string
}

const results: LayerReport[] = []

for (const tc of TEST_CASES) {
  const refPath = path.join(REF_DIR, `${tc.id}.png`)
  const l1Path  = path.join(L1_DIR,  `${tc.id}.png`)
  const l2Path  = path.join(L2_DIR,  `${tc.id}.png`)

  const ref = readPng(refPath)
  const l1  = readPng(l1Path)
  const l2  = readPng(l2Path)

  let l1VsRef = null
  let l2VsRef = null
  let l1VsL2  = null

  if (ref && l1) {
    const { diffPixels, total, sizeMismatch } = comparePngs(ref, l1, path.join(DIFF_L2_DIR, `${tc.id}.l1-vs-ref.png`))
    l1VsRef = { diffPx: diffPixels, pct: matchPct(diffPixels, total), sizeMismatch }
  }
  if (ref && l2) {
    const { diffPixels, total, sizeMismatch } = comparePngs(ref, l2, path.join(DIFF_L2_DIR, `${tc.id}.l2-vs-ref.png`))
    l2VsRef = { diffPx: diffPixels, pct: matchPct(diffPixels, total), sizeMismatch }
  }
  if (l1 && l2) {
    const { diffPixels, total, sizeMismatch } = comparePngs(l1, l2, path.join(DIFF_L2_DIR, `${tc.id}.l1-vs-l2.png`))
    l1VsL2 = { diffPx: diffPixels, pct: matchPct(diffPixels, total), sizeMismatch }
  }

  // Diagnosis
  let diagnosis = '?'
  const l1Pass = l1VsRef?.diffPx === 0
  const l2Pass = l2VsRef?.diffPx === 0
  const wysiwygPass = l1VsL2?.diffPx === 0
  if (!l1 && !l2)             diagnosis = 'MISSING (run capture.spec.ts + app-integration.spec.ts)'
  else if (!l1)               diagnosis = 'L1 missing (run capture.spec.ts)'
  else if (!l2)               diagnosis = 'L2 missing (run app-integration.spec.ts)'
  else if (wysiwygPass)       diagnosis = l1Pass ? '✓ WYSIWYG pass (both match reference)' : '✓ WYSIWYG match (both differ from ref equally — logic bug)'
  else if (l1Pass && !l2Pass) diagnosis = '⚠ CSS regression: L1 pass, L2 fails vs reference'
  else if (!l1Pass && l2Pass) diagnosis = '? Unexpected: L1 fail, L2 pass'
  else                        diagnosis = `⚠ Both differ: L1↔Ref ${l1VsRef?.pct}%, L2↔Ref ${l2VsRef?.pct}%, L1↔L2 match ${l1VsL2?.pct}%`

  results.push({ id: tc.id, title: tc.title, l1VsRef, l2VsRef, l1VsL2, diagnosis })
}

// Print table
const w = (s: string | null, width: number) => (s ?? '—').padEnd(width).slice(0, width)
console.log('\n── Layer 1 vs Layer 2 Cross-Comparison ──────────────────────────────────────────')
console.log(w('ID', 22) + w('L1↔Ref%', 10) + w('L2↔Ref%', 10) + w('L1↔L2%', 10) + 'Diagnosis')
console.log('─'.repeat(90))
for (const r of results) {
  const l1p = r.l1VsRef ? String(r.l1VsRef.pct) : '—'
  const l2p = r.l2VsRef ? String(r.l2VsRef.pct) : '—'
  const wp  = r.l1VsL2  ? String(r.l1VsL2.pct)  : '—'
  console.log(w(r.id, 22) + w(l1p, 10) + w(l2p, 10) + w(wp, 10) + r.diagnosis)
}

// Summary
const wysiwyg  = results.filter(r => r.l1VsL2?.diffPx === 0).length
const cssReg   = results.filter(r => r.l1VsRef?.diffPx === 0 && r.l2VsRef?.diffPx !== 0).length
console.log(`\nWYSIWYG matches: ${wysiwyg}/${results.length} | CSS regressions: ${cssReg}`)
console.log(`Diff PNGs written to: ${DIFF_L2_DIR}\n`)
