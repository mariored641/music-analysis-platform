#!/usr/bin/env tsx
/**
 * MAP Renderer — Extract Numeric Reference Data from webmscore
 *
 * For each MusicXML fixture, loads via webmscore WASM and extracts:
 *   1. measurePositions() — bounding boxes per measure
 *   2. segmentPositions() — bounding boxes per beat-level segment
 *   3. saveSvg() → parsed to extract notes, stems, beams, staff lines, barlines, chord symbols
 *
 * Output: renderer-tests/reference-data/<id>.ref.json
 *
 * Usage:
 *   npx tsx renderer-tests/scripts/extract-reference-data.ts
 *   npx tsx renderer-tests/scripts/extract-reference-data.ts --id=01-noteheads
 */

import * as fs from 'fs'
import * as path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { DOMParser } from 'linkedom'

// ─── Node.js 24 Polyfills for webmscore WASM ─────────────────────────────────
// webmscore's Emscripten build uses fetch() and XHR to load .wasm/.data files.
// Node.js 24 fails on file:// URLs with fetch. Patch both.

// 1. Patch navigator
if (typeof globalThis.navigator === 'undefined' || Object.getOwnPropertyDescriptor(globalThis, 'navigator')?.get) {
  Object.defineProperty(globalThis, 'navigator', {
    value: (globalThis as Record<string, unknown>).navigator ?? {},
    writable: true,
    configurable: true,
  })
}

// 2. Patch fetch to handle file:// URLs
const originalFetch = globalThis.fetch
globalThis.fetch = async function patchedFetch(input: any, init?: any): Promise<Response> {
  const url = typeof input === 'string' ? input : input?.url || String(input)

  // Handle file:// URLs
  if (url.startsWith('file://') || url.startsWith('file:///')) {
    const filePath = fileURLToPath(url)
    const buffer = fs.readFileSync(filePath)
    return new Response(buffer, {
      status: 200,
      headers: { 'content-type': 'application/wasm' },
    })
  }

  // Handle bare file paths or relative paths (Emscripten sometimes uses these)
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
    let filePath = url
    if (!path.isAbsolute(filePath)) {
      const webmscoreDir = path.dirname(require.resolve('webmscore'))
      filePath = path.join(webmscoreDir, filePath)
    }
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath)
      return new Response(buffer, {
        status: 200,
        headers: { 'content-type': 'application/wasm' },
      })
    }
  }

  return originalFetch(input, init)
}

// 3. Polyfill XMLHttpRequest for Emscripten data file loading
if (typeof globalThis.XMLHttpRequest === 'undefined') {
  class NodeXHR {
    status = 0
    response: ArrayBuffer | null = null
    responseType = ''
    readyState = 0
    onload: (() => void) | null = null
    onerror: ((e: any) => void) | null = null
    onprogress: ((e: any) => void) | null = null

    private _url = ''
    private _method = ''

    open(method: string, url: string) {
      this._method = method
      this._url = url
    }

    send() {
      try {
        // Resolve relative paths against webmscore package dir
        let filePath = this._url
        if (!path.isAbsolute(filePath) && !filePath.startsWith('file:')) {
          const webmscoreDir = path.dirname(require.resolve('webmscore'))
          filePath = path.join(webmscoreDir, filePath)
        } else if (filePath.startsWith('file:')) {
          filePath = fileURLToPath(filePath)
        }

        const buf = fs.readFileSync(filePath)
        this.status = 200
        this.readyState = 4
        this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
        if (this.onload) this.onload()
      } catch (e) {
        this.status = 404
        if (this.onerror) this.onerror(e)
      }
    }
  }
  ;(globalThis as any).XMLHttpRequest = NodeXHR
}

const require = createRequire(import.meta.url)

// 4. Polyfill window/location for Emscripten
if (typeof globalThis.window === 'undefined') {
  ;(globalThis as any).window = globalThis
}
if (typeof globalThis.location === 'undefined') {
  const webmscoreDir = 'file:///' + path.dirname(require.resolve('webmscore')).replace(/\\/g, '/') + '/'
  ;(globalThis as any).location = { pathname: webmscoreDir, href: webmscoreDir }
}

const WebMscore = require('webmscore')

import { TEST_CASES } from '../test-cases.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = path.resolve(__dirname, '..')
const PROJECT_ROOT = path.resolve(ROOT, '..')
const FIXTURES = path.resolve(PROJECT_ROOT, 'public', 'renderer-tests', 'fixtures')
const REF_DATA_DIR = path.join(ROOT, 'reference-data')

fs.mkdirSync(REF_DATA_DIR, { recursive: true })

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const idArg = args.find(a => a.startsWith('--id='))?.slice(5)
const verbose = args.includes('--verbose') || args.includes('-v')
const cases = idArg ? TEST_CASES.filter(tc => tc.id === idArg) : TEST_CASES

if (cases.length === 0) {
  console.error(`No test case found with id: ${idArg}`)
  process.exit(1)
}

// ─── SVG Parsing Helpers ─────────────────────────────────────────────────────

interface RefNote {
  x: number
  y: number
  glyph: string
  measure: number  // estimated from x-position
}

interface RefStem {
  x: number
  yTop: number
  yBottom: number
}

interface RefBeam {
  points: string  // polygon points or path d attribute
}

interface RefStaffLine {
  y: number
  x1: number
  x2: number
}

interface RefBarline {
  x: number
  yTop: number
  yBottom: number
}

interface RefChordSymbol {
  x: number
  y: number
  text: string
}

interface ReferenceData {
  id: string
  timestamp: string
  pageSize: { width: number; height: number }
  measures: Array<{ id: number; x: number; y: number; sx: number; sy: number; page: number }>
  segments: Array<{ id: number; x: number; y: number; sx: number; sy: number; page: number }>
  staffLines: RefStaffLine[]
  notes: RefNote[]
  stems: RefStem[]
  beams: RefBeam[]
  chordSymbols: RefChordSymbol[]
  barlines: RefBarline[]
}

// Known SMuFL notehead codepoints (Leland / Bravura)
const NOTEHEAD_CODEPOINTS: Record<string, string> = {
  '\uE0A0': 'noteheadDoubleWhole',
  '\uE0A2': 'noteheadWhole',
  '\uE0A3': 'noteheadHalf',
  '\uE0A4': 'noteheadBlack',
  '\uE0A5': 'noteheadXOrnate',
  '\uE0A8': 'noteheadDiamondWhole',
  '\uE0A9': 'noteheadDiamondHalf',
  '\uE0AA': 'noteheadDiamondBlack',
}

function parseSvg(svgString: string): {
  staffLines: RefStaffLine[]
  notes: RefNote[]
  stems: RefStem[]
  beams: RefBeam[]
  chordSymbols: RefChordSymbol[]
  barlines: RefBarline[]
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svg = doc.documentElement

  const staffLines: RefStaffLine[] = []
  const notes: RefNote[] = []
  const stems: RefStem[] = []
  const beams: RefBeam[] = []
  const chordSymbols: RefChordSymbol[] = []
  const barlines: RefBarline[] = []

  // ── webmscore SVG format (MuseScore 4):
  //   All elements are <polyline> or <polygon> or <path> with CamelCase class names:
  //   StaffLines, BarLine, Stem, Note, Beam, Clef, TimeSig, LedgerLine, Text, etc.
  //
  //   Staff lines = <polyline class="StaffLines" points="x1,y1 x2,y2"/>
  //   Barlines = <polyline class="BarLine" points="x1,y1 x2,y2"/>
  //   Stems = <polyline class="Stem" points="x1,y1 x2,y2"/>
  //   Beams = <polygon class="Beam" points="..."/>
  //   Notes = <path class="Note" d="..."/> (complex path — extract bbox from d attribute)
  //   Chord symbols = not directly extractable (rendered as paths)

  function parsePolylinePoints(points: string): number[][] {
    return points.trim().split(/\s+/).map(p => p.split(',').map(Number))
  }

  // Helper: extract approximate bounding box from SVG path d attribute
  function pathBBox(d: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const nums = d.match(/-?\d+\.?\d*/g)
    if (!nums || nums.length < 4) return null
    const values = nums.map(Number)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < values.length - 1; i += 2) {
      const x = values[i], y = values[i + 1]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return { minX, minY, maxX, maxY }
  }

  // ── Parse all polylines
  const allPolylines = svg.querySelectorAll('polyline')
  for (const pl of allPolylines) {
    const cls = pl.getAttribute('class') || ''
    const points = pl.getAttribute('points') || ''
    const coords = parsePolylinePoints(points)

    if (cls === 'StaffLines' && coords.length === 2) {
      const [x1, y1] = coords[0]
      const [x2, y2] = coords[1]
      if (Math.abs(y1 - y2) < 0.5 && Math.abs(x2 - x1) > 100) {
        staffLines.push({ y: y1, x1, x2 })
      }
    }

    if (cls === 'BarLine' && coords.length === 2) {
      const [x1, y1] = coords[0]
      const [x2, y2] = coords[1]
      if (Math.abs(x1 - x2) < 1) {
        barlines.push({ x: (x1 + x2) / 2, yTop: Math.min(y1, y2), yBottom: Math.max(y1, y2) })
      }
    }

    if (cls === 'Stem' && coords.length === 2) {
      const [x1, y1] = coords[0]
      const [x2, y2] = coords[1]
      stems.push({ x: (x1 + x2) / 2, yTop: Math.min(y1, y2), yBottom: Math.max(y1, y2) })
    }
  }

  // ── Parse beams (polygon elements)
  const allPolygons = svg.querySelectorAll('polygon')
  for (const poly of allPolygons) {
    const cls = poly.getAttribute('class') || ''
    const points = poly.getAttribute('points') || ''
    if (cls === 'Beam' && points) {
      beams.push({ points })
    }
  }

  // Helper: extract tx, ty and scale from transform="matrix(a,b,c,d,tx,ty)"
  function parseTransform(transform: string): { tx: number; ty: number; sx: number; sy: number } | null {
    const m = transform.match(/matrix\(([^)]+)\)/)
    if (!m) return null
    const parts = m[1].split(',').map(Number)
    if (parts.length < 6) return null
    return { sx: parts[0], sy: parts[3], tx: parts[4], ty: parts[5] }
  }

  // ── Parse notes and beams from path elements
  const allPaths = svg.querySelectorAll('path')
  for (const p of allPaths) {
    const cls = p.getAttribute('class') || ''
    const d = p.getAttribute('d') || ''
    const transform = p.getAttribute('transform') || ''

    if (cls === 'Note') {
      // Note position comes from the transform matrix, not the path data
      const xf = parseTransform(transform)
      if (xf) {
        // The path d is in local coordinates (glyph shape).
        // The transform translates it to page coordinates.
        // tx,ty is the top-left of the glyph; add half the scaled bbox for center
        const bbox = pathBBox(d)
        if (bbox) {
          const cx = xf.tx + (bbox.minX + bbox.maxX) / 2 * Math.abs(xf.sx)
          const cy = xf.ty + (bbox.minY + bbox.maxY) / 2 * Math.abs(xf.sy)
          notes.push({ x: cx, y: cy, glyph: 'note', measure: 0 })
        } else {
          // Fallback: just use transform origin
          notes.push({ x: xf.tx, y: xf.ty, glyph: 'note', measure: 0 })
        }
      } else {
        // No transform — try path bbox directly
        const bbox = pathBBox(d)
        if (bbox) {
          notes.push({ x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2, glyph: 'note', measure: 0 })
        }
      }
    }

    // Beams are also <path class="Beam"> (not polygon)
    if (cls === 'Beam' && d) {
      beams.push({ points: d })
    }
  }

  return { staffLines, notes, stems, beams, chordSymbols, barlines }
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('\n🔬 Extracting reference data from webmscore\n')
console.log(`  Fixtures : ${FIXTURES}`)
console.log(`  Output   : ${REF_DATA_DIR}`)
console.log(`  Cases    : ${cases.length}\n`)

await new Promise<void>(resolve => WebMscore.ready.then(resolve))
console.log(`  webmscore ready\n`)

let ok = 0, fail = 0

for (const tc of cases) {
  const xmlPath = path.join(FIXTURES, path.basename(tc.fixtureFile))
  const outPath = path.join(REF_DATA_DIR, `${tc.id}.ref.json`)

  if (!fs.existsSync(xmlPath)) {
    console.log(`  ⬜ SKIP    ${tc.id}  (fixture not found)`)
    fail++
    continue
  }

  try {
    const xmlData = new Uint8Array(fs.readFileSync(xmlPath))
    const score = await WebMscore.load('xml', xmlData, [])

    // 1. Measure positions
    const measurePos = await score.measurePositions()
    const measures = measurePos.elements.map((el: any) => ({
      id: el.id, x: el.x, y: el.y, sx: el.sx, sy: el.sy, page: el.page,
    }))

    // 2. Segment positions (may fail on some WASM builds — graceful fallback)
    let segments: Array<{ id: number; x: number; y: number; sx: number; sy: number; page: number }> = []
    try {
      const segmentPos = await score.segmentPositions()
      segments = segmentPos.elements.map((el: any) => ({
        id: el.id, x: el.x, y: el.y, sx: el.sx, sy: el.sy, page: el.page,
      }))
    } catch {
      // segmentPositions fails on some WASM/Node combinations — skip
    }

    // 3. SVG parsing
    const svgString = await score.saveSvg(0)
    const svgData = parseSvg(svgString)

    await score.destroy()

    const refData: ReferenceData = {
      id: tc.id,
      timestamp: new Date().toISOString(),
      pageSize: measurePos.pageSize,
      measures,
      segments,
      ...svgData,
    }

    fs.writeFileSync(outPath, JSON.stringify(refData, null, 2))

    const stats = [
      `${measures.length} measures`,
      `${segments.length} segments`,
      `${svgData.staffLines.length} staff lines`,
      `${svgData.notes.length} notes`,
      `${svgData.stems.length} stems`,
      `${svgData.beams.length} beams`,
      `${svgData.chordSymbols.length} chords`,
      `${svgData.barlines.length} barlines`,
    ].join(', ')

    console.log(`  ✅ ${tc.id}  (${stats})`)
    if (verbose) {
      console.log(`     Page: ${refData.pageSize.width}×${refData.pageSize.height}`)
      if (measures.length > 0) {
        console.log(`     m1: x=${measures[0].x} y=${measures[0].y} w=${measures[0].sx} h=${measures[0].sy}`)
      }
    }
    ok++
  } catch (e) {
    console.error(`  ❌ ${tc.id}  ERROR: ${e}`)
    fail++
  }
}

console.log('')
console.log('─'.repeat(50))
console.log(`  Extracted : ${ok}`)
console.log(`  Failed    : ${fail}`)
console.log('─'.repeat(50))
console.log('')

if (ok > 0) {
  console.log(`  Reference data saved to: ${REF_DATA_DIR}`)
  console.log('  Next: npx tsx renderer-tests/pipeline/run.ts --all')
  console.log('')
}

process.exit(fail > 0 ? 1 : 0)
